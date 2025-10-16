import config from './config.js';
import {
  clampBearing,
  formatAircraftDescription,
  getCategoryInfo,
  lowercaseFirst,
  resolveAltitudeFt,
  resolveSpeedMph,
  stripTrailingPunctuation,
  truncateMessage,
  variantIndex,
} from './utils.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Evaluate a list of range templates and return the first matching string.
 * @param {number} value
 * @param {{test:(value:number)=>boolean,template:(value:number)=>string}[]} templates
 * @returns {string|null}
 */
const matchTemplate = (value, templates) => {
  if (!Array.isArray(templates)) {
    return null;
  }
  for (const { test, template } of templates) {
    if (test(value)) {
      return template(value);
    }
  }
  return null;
};

const rotorcraftSpeedTemplates = [
  {
    test: (mph) => mph >= 130,
    template: (mph) => `Chopping through at about ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 80,
    template: (mph) => `Cruising the pattern around ${mph} mph.`,
  },
  { test: () => true, template: (mph) => `Hovering around ${mph} mph.` },
];

const highPerfSpeedTemplates = [
  {
    test: (mph) => mph >= 300,
    template: (mph) => `Ripping along near ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 200,
    template: (mph) => `Keeping the throttle up around ${mph} mph.`,
  },
  {
    test: () => true,
    template: (mph) => `Loosening the reins near ${mph} mph.`,
  },
];

const heavySpeedTemplates = [
  { test: (mph) => mph >= 300, template: (mph) => `Hauling near ${mph} mph.` },
  { test: (mph) => mph >= 200, template: (mph) => `Rolling near ${mph} mph.` },
  {
    test: () => true,
    template: (mph) => `Keeping the widebody moving near ${mph} mph.`,
  },
];

const largeSpeedTemplates = [
  {
    test: (mph) => mph >= 280,
    template: (mph) => `Making a brisk pass around ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 200,
    template: (mph) => `Keeping the cadence near ${mph} mph.`,
  },
  { test: () => true, template: (mph) => `Rolling by around ${mph} mph.` },
];

const lightSpeedTemplates = [
  { test: (mph) => mph >= 200, template: (mph) => `Scooting near ${mph} mph.` },
  { test: (mph) => mph >= 120, template: (mph) => `Skipping near ${mph} mph.` },
  { test: (mph) => mph >= 60, template: (mph) => `Gliding near ${mph} mph.` },
  { test: () => true, template: (mph) => `Loitering near ${mph} mph.` },
];

const smallSpeedTemplates = [
  { test: (mph) => mph >= 200, template: (mph) => `Pacing near ${mph} mph.` },
  { test: (mph) => mph >= 120, template: (mph) => `Scooting near ${mph} mph.` },
  { test: (mph) => mph >= 60, template: (mph) => `Easy pass near ${mph} mph.` },
  { test: () => true, template: (mph) => `Loitering near ${mph} mph.` },
];

const SPEED_TEMPLATES = {
  rotorcraft: rotorcraftSpeedTemplates,
  'high-perf': highPerfSpeedTemplates,
  heavy: heavySpeedTemplates,
  'wake-maker': heavySpeedTemplates,
  large: largeSpeedTemplates,
  light: lightSpeedTemplates,
  small: smallSpeedTemplates,
};

const DEFAULT_SPEED_TEMPLATES = [
  {
    test: (mph) => mph >= 300,
    template: (mph) => `Bolting along near ${mph} mph.`,
  },
  { test: (mph) => mph >= 200, template: (mph) => `Cruising near ${mph} mph.` },
  {
    test: (mph) => mph >= 120,
    template: (mph) => `Making good time around ${mph} mph.`,
  },
  {
    test: (mph) => mph >= 60,
    template: (mph) => `Taking a leisurely pass around ${mph} mph.`,
  },
  { test: () => true, template: (mph) => `Drifting by around ${mph} mph.` },
];

const formatFeet = (value) => Math.round(value).toLocaleString();

const rotorcraftAltitudeTemplates = [
  {
    test: (alt) => alt <= 1200,
    template: (alt) => `Skimming the skyline near ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt) => `Holding above town around ${formatFeet(alt)} ft.`,
  },
];

const heavyAltitudeTemplates = [
  {
    test: (alt) => alt >= 30000,
    template: (alt) => `Stacked way up near ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 20000,
    template: (alt) => `Cruising that big frame near ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt) => `Looming overhead around ${formatFeet(alt)} ft.`,
  },
  { test: () => true, template: (alt) => `Low around ${formatFeet(alt)} ft.` },
];

const highPerfAltitudeTemplates = [
  {
    test: (alt) => alt >= 20000,
    template: (alt) => `Knifing through around ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt) => `Slicing the sky near ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt) => `Darting by around ${formatFeet(alt)} ft.`,
  },
];

const lightAltitudeTemplates = [
  {
    test: (alt) => alt >= 10000,
    template: (alt) => `High near ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 5000,
    template: (alt) => `Mid near ${formatFeet(alt)} ft.`,
  },
  { test: () => true, template: (alt) => `Low near ${formatFeet(alt)} ft.` },
];

const smallAltitudeTemplates = [
  {
    test: (alt) => alt >= 10000,
    template: (alt) => `Steady near ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 5000,
    template: (alt) => `Level near ${formatFeet(alt)} ft.`,
  },
  { test: () => true, template: (alt) => `Low near ${formatFeet(alt)} ft.` },
];

const largeAltitudeTemplates = [
  {
    test: (alt) => alt >= 20000,
    template: (alt) => `Cruising solid near ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt) => `Keeping a stately perch near ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt) => `Rolling through around ${formatFeet(alt)} ft.`,
  },
];

const ALTITUDE_TEMPLATES = {
  rotorcraft: rotorcraftAltitudeTemplates,
  heavy: heavyAltitudeTemplates,
  'wake-maker': heavyAltitudeTemplates,
  'high-perf': highPerfAltitudeTemplates,
  light: lightAltitudeTemplates,
  small: smallAltitudeTemplates,
  large: largeAltitudeTemplates,
};

const DEFAULT_ALTITUDE_TEMPLATES = [
  {
    test: (alt) => alt >= 30000,
    template: (alt) => `Way up around ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 20000,
    template: (alt) => `Cruising high near ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 10000,
    template: (alt) => `Gliding along around ${formatFeet(alt)} ft.`,
  },
  {
    test: (alt) => alt >= 5000,
    template: (alt) => `Keeping a comfy perch near ${formatFeet(alt)} ft.`,
  },
  {
    test: () => true,
    template: (alt) => `Keeping it low near ${formatFeet(alt)} ft.`,
  },
];

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

const formatSpeed = (mph, categoryInfo) => {
  if (!Number.isFinite(mph) || mph <= 0) {
    return null;
  }

  const category = categoryInfo?.shortLabel
    ? categoryInfo.shortLabel.toLowerCase()
    : null;
  const categoryMessage = category
    ? matchTemplate(mph, SPEED_TEMPLATES[category])
    : null;
  return categoryMessage ?? matchTemplate(mph, DEFAULT_SPEED_TEMPLATES);
};

const formatAltitude = (altitude, categoryInfo) => {
  if (!Number.isFinite(altitude) || altitude <= 0) {
    return null;
  }

  const category = categoryInfo?.shortLabel
    ? categoryInfo.shortLabel.toLowerCase()
    : null;
  const categoryMessage = category
    ? matchTemplate(altitude, ALTITUDE_TEMPLATES[category])
    : null;
  return categoryMessage ?? matchTemplate(altitude, DEFAULT_ALTITUDE_TEMPLATES);
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

  const dbFlagsRaw =
    typeof plane.dbFlags === 'string' ? plane.dbFlags.trim() : '';
  const isMilitary = dbFlagsRaw.startsWith('1');
  const isInteresting = dbFlagsRaw.length > 1 && dbFlagsRaw[1] === '1';
  const operatorName =
    dbFlagsRaw && plane.ownOp ? formatAircraftDescription(plane.ownOp) : null;
  const militarySentence = isMilitary
    ? '🪖 Military traffic on the scope.'
    : null;
  const interestingSentence = isInteresting ? '🕵️ Interesting traffic.' : null;
  const operatorSentence = operatorName ? `Operated by ${operatorName}.` : null;

  const speedPhrase = formatSpeed(resolveSpeedMph(plane), categoryInfo);
  const altitudePhrase = formatAltitude(resolveAltitudeFt(plane), categoryInfo);
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
    movementSentence,
    militarySentence,
    interestingSentence,
    operatorSentence,
    frequencySentence,
  ].filter(Boolean);

  const limit = 280;
  const linkLine = includeDetailsLink ? detailsUrl : null;

  const infoText = infoSentences.join(' ');
  let remaining = limit - primaryLine.length;
  let linkSegment = null;
  if (linkLine) {
    const linkNeeded = linkLine.length + 2;
    if (remaining >= linkNeeded) {
      remaining -= linkNeeded;
      linkSegment = linkLine;
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

  const body = linkSegment ? `${text}\n\n${linkSegment}` : text;

  return {
    title: undefined,
    body,
  };
};

export default {
  summarizeSightings,
  composeNotificationMessage,
};
