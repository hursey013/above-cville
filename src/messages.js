import config from './config.js';
import logger from './logger.js';
import {
  clampBearing,
  formatAircraftDescription,
  getCategoryInfo,
  lowercaseFirst,
  resolveAltitudeFt,
  resolveSpeedMph,
  stripTrailingPunctuation,
  truncateMessage,
  matchTemplate,
  createApproxWordPicker,
  variantIndex,
} from './utils.js';
import { buildPlanePhotoPageUrl } from './photos.js';
import {
  defaultAltitudeTemplates,
  defaultSpeedTemplates,
  heavyAltitudeTemplates,
  heavySpeedTemplates,
  highPerfAltitudeTemplates,
  highPerfSpeedTemplates,
  largeAltitudeTemplates,
  largeSpeedTemplates,
  lightAltitudeTemplates,
  lightSpeedTemplates,
  rotorcraftAltitudeTemplates,
  rotorcraftSpeedTemplates,
  smallAltitudeTemplates,
  smallSpeedTemplates,
} from './templates/index.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const SPEED_TEMPLATES = {
  rotorcraft: rotorcraftSpeedTemplates,
  'high-perf': highPerfSpeedTemplates,
  heavy: heavySpeedTemplates,
  'wake-maker': heavySpeedTemplates,
  large: largeSpeedTemplates,
  light: lightSpeedTemplates,
  small: smallSpeedTemplates,
};

const DEFAULT_SPEED_TEMPLATES = defaultSpeedTemplates;

const ALTITUDE_TEMPLATES = {
  rotorcraft: rotorcraftAltitudeTemplates,
  heavy: heavyAltitudeTemplates,
  'wake-maker': heavyAltitudeTemplates,
  'high-perf': highPerfAltitudeTemplates,
  light: lightAltitudeTemplates,
  small: smallAltitudeTemplates,
  large: largeAltitudeTemplates,
};

const DEFAULT_ALTITUDE_TEMPLATES = defaultAltitudeTemplates;

const INTRO_VARIANTS = [
  'Can you see it?',
  'Look up!',
  'There it goes!',
  'Up above!',
];

/**
 * Produce aggregate stats about previous sightings for a plane.
 * @param {number[]} timestamps - Epoch milliseconds of sightings/notifications.
 * @param {number} [now=Date.now()] - Reference timestamp for comparisons.
 * @returns {{total:number,lastHour:number,lastDay:number,lastWeek:number,lastSeen:number|null,firstSeen:number|null,averageIntervalMs:number|null}}
 */
export const summarizeSightings = (timestamps = [], now = Date.now()) => {
  if (!Array.isArray(timestamps)) {
    return {
      total: 0,
      lastHour: 0,
      lastDay: 0,
      lastWeek: 0,
      lastSeen: null,
      firstSeen: null,
      averageIntervalMs: null,
    };
  }

  const valid = timestamps
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!valid.length) {
    return {
      total: 0,
      lastHour: 0,
      lastDay: 0,
      lastWeek: 0,
      lastSeen: null,
      firstSeen: null,
      averageIntervalMs: null,
    };
  }

  const lastSeen = valid[valid.length - 1];
  const firstSeen = valid[0];
  const lastHour = valid.filter((value) => now - value <= HOUR_MS).length;
  const lastDay = valid.filter((value) => now - value <= DAY_MS).length;
  const lastWeek = valid.filter((value) => now - value <= WEEK_MS).length;

  let averageIntervalMs = null;
  if (valid.length > 1) {
    let totalInterval = 0;
    for (let index = 1; index < valid.length; index += 1) {
      totalInterval += valid[index] - valid[index - 1];
    }
    averageIntervalMs = totalInterval / (valid.length - 1);
  }

  return {
    total: valid.length,
    lastHour,
    lastDay,
    lastWeek,
    lastSeen,
    firstSeen,
    averageIntervalMs,
  };
};

const formatSpeed = (mph, categoryInfo, pickApproxWord) => {
  if (!Number.isFinite(mph) || mph <= 0) {
    return null;
  }

  const category = categoryInfo?.shortLabel
    ? categoryInfo.shortLabel.toLowerCase()
    : null;
  const categoryMessage = category
    ? matchTemplate(mph, SPEED_TEMPLATES[category], pickApproxWord)
    : null;
  return (
    categoryMessage ??
    matchTemplate(mph, DEFAULT_SPEED_TEMPLATES, pickApproxWord)
  );
};

const formatAltitude = (altitude, categoryInfo, pickApproxWord) => {
  if (!Number.isFinite(altitude) || altitude <= 0) {
    return null;
  }

  const category = categoryInfo?.shortLabel
    ? categoryInfo.shortLabel.toLowerCase()
    : null;
  const categoryMessage = category
    ? matchTemplate(altitude, ALTITUDE_TEMPLATES[category], pickApproxWord)
    : null;
  return (
    categoryMessage ??
    matchTemplate(altitude, DEFAULT_ALTITUDE_TEMPLATES, pickApproxWord)
  );
};

const frequencyMessage = (stats) => {
  if (stats.total <= 1) {
    return "First time we've spotted this one. 👋";
  }

  if (stats.lastHour >= 3) {
    return `${stats.lastHour} pings this hour.`;
  }

  if (stats.lastDay >= 3) {
    return `Busy day: ${stats.lastDay} flybys today.`;
  }

  if (stats.lastWeek >= 3) {
    return `Regular visitor — ${stats.lastWeek} sightings this week.`;
  }

  const historySpan =
    stats.lastSeen && stats.firstSeen ? stats.lastSeen - stats.firstSeen : 0;
  const hasMultiDayHistory = historySpan >= 2 * DAY_MS;

  if (
    stats.averageIntervalMs &&
    stats.averageIntervalMs < DAY_MS &&
    hasMultiDayHistory
  ) {
    return 'We catch them almost every day.';
  }

  return `Seen ${stats.total} times so far.`;
};

const directionMessage = (plane) => {
  const directionCandidates = [
    plane.track,
    plane.trak,
    plane.dir,
    plane.heading,
  ];
  for (const candidate of directionCandidates) {
    const bearing =
      typeof candidate === 'string' ? Number(candidate) : candidate;
    const cardinal = clampBearing(bearing);
    if (cardinal) {
      return `headed ${cardinal}`;
    }
  }
  return null;
};

/**
 * Build a conversational notification title + body for a detected aircraft.
 * @param {Record<string, any>} plane - Raw plane object from airplanes.live.
 * @param {number[]} timestamps - Historical notification timestamps for this plane.
 * @param {number} [now=Date.now()] - Reference timestamp.
 * @returns {{title: string|undefined, body: string}}
 */
export const composeNotificationMessage = (
  plane,
  timestamps = [],
  now = Date.now(),
) => {
  const identity =
    plane.flight?.trim() ||
    plane.registration ||
    plane.r ||
    plane.hex?.toUpperCase() ||
    'Unknown aircraft';
  const stats = summarizeSightings(timestamps, now);

  const linkBase = config.aircraftLinkBase;
  const hex = plane.hex ? String(plane.hex).toLowerCase() : null;
  const detailsUrl = hex && linkBase ? `${linkBase}${hex}` : null;
  const linkedIdentity = detailsUrl ? `[${identity}](${detailsUrl})` : identity;
  const includeDetailsLink = Boolean(detailsUrl) && config.showDetailsLink;
  const descriptiveIdentity = includeDetailsLink ? identity : linkedIdentity;
  const description = formatAircraftDescription(plane.desc);
  const subjectIdentity = description
    ? `${descriptiveIdentity} (${description})`
    : descriptiveIdentity;

  const categoryInfo =
    getCategoryInfo(plane.category ?? plane.cat) ?? undefined;

  const rawDbFlags = plane.dbFlags;
  let dbFlag = null;
  if (typeof rawDbFlags === 'number' && Number.isFinite(rawDbFlags)) {
    dbFlag = rawDbFlags;
  } else if (typeof rawDbFlags === 'string') {
    const parsed = Number(rawDbFlags.trim());
    if (Number.isFinite(parsed)) {
      dbFlag = parsed;
    }
  }

  if (dbFlag !== null && dbFlag !== 1 && dbFlag !== 2) {
    logger.warn(
      { dbFlag, plane },
      'Unexpected dbFlags value from airplanes.live payload',
    );
  }

  const isMilitary = dbFlag === 1;
  const isInteresting = dbFlag === 2;
  const operatorName =
    dbFlag !== null && plane.ownOp
      ? formatAircraftDescription(plane.ownOp)
      : null;
  const militarySentence = isMilitary
    ? '🪖 Military traffic on the scope.'
    : null;
  const interestingSentence = isInteresting ? '🕵️ Interesting traffic.' : null;
  const operatorSentence = operatorName ? `Operated by ${operatorName}.` : null;

  const pickApproxWord = createApproxWordPicker();
  const speedPhrase = formatSpeed(
    resolveSpeedMph(plane),
    categoryInfo,
    pickApproxWord,
  );
  const altitudePhrase = formatAltitude(
    resolveAltitudeFt(plane),
    categoryInfo,
    pickApproxWord,
  );
  const directionPhrase = directionMessage(plane);
  const frequencySentence = frequencyMessage(stats);

  const intro =
    INTRO_VARIANTS[variantIndex(identity, stats, INTRO_VARIANTS.length)];
  const categoryEmoji = categoryInfo?.emoji ?? '✈️';
  const primaryLine = `${intro} ${categoryEmoji}`;

  const movementClauses = [speedPhrase, altitudePhrase, directionPhrase]
    .map((clause) => stripTrailingPunctuation(clause ?? ''))
    .filter(Boolean);

  let movementSentence = null;
  if (movementClauses.length) {
    const clauses = movementClauses.map((clause) => lowercaseFirst(clause));
    const lastClause = clauses.pop();
    let combined = '';
    if (!clauses.length) {
      combined = lastClause;
    } else if (clauses.length === 1) {
      combined = `${clauses[0]} and ${lastClause}`;
    } else {
      combined = `${clauses.join(', ')}, and ${lastClause}`;
    }
    movementSentence = `${subjectIdentity} is ${combined}.`;
  } else if (description) {
    movementSentence = `${subjectIdentity} is overhead.`;
  } else {
    movementSentence = `${descriptiveIdentity} is overhead.`;
  }

  const infoSentences = [
    militarySentence,
    interestingSentence,
    movementSentence,
    operatorSentence,
    frequencySentence,
  ].filter(Boolean);

  const limit = 300;
  const linkLine = includeDetailsLink ? detailsUrl : null;
  const linkText = linkLine ? `📡 ${linkLine}` : null;
  const photoPageUrl = buildPlanePhotoPageUrl(
    plane.registration ?? plane.r ?? plane.flight,
  );
  const photoLinkText = photoPageUrl ? `📷 ${photoPageUrl}` : null;

  const infoText = infoSentences.join(' ');
  let remaining = limit - primaryLine.length;
  const linkSegments = [];
  if (linkText) {
    const linkNeeded = linkText.length + 2;
    if (remaining >= linkNeeded) {
      remaining -= linkNeeded;
      linkSegments.push(linkText);
    }
  }
  if (photoLinkText) {
    const photoLinkNeeded = photoLinkText.length + 2;
    if (remaining >= photoLinkNeeded) {
      remaining -= photoLinkNeeded;
      linkSegments.push(photoLinkText);
    }
  }

  let infoCore = '';
  if (infoText && remaining > 1) {
    const infoLimit = remaining - 1;
    if (infoLimit > 0) {
      const candidate = truncateMessage(infoText, infoLimit);
      if (candidate) {
        infoCore = candidate;
        remaining -= 1 + infoCore.length;
      }
    }
  }

  const textSegments = [primaryLine];
  if (infoCore) {
    textSegments.push(infoCore);
  }
  const text = textSegments.join(' ');

  const linkBlock =
    linkSegments.length === 1
      ? linkSegments[0]
      : linkSegments.length > 1
        ? linkSegments.join('\n')
        : null;
  const body = linkBlock ? `${text}\n\n${linkBlock}` : text;

  return {
    title: undefined,
    body,
  };
};

export default {
  summarizeSightings,
  composeNotificationMessage,
};
