import config from './config.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const KNOTS_TO_MPH = 1.15078;

const cardinalDirections = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

const CATEGORY_SUMMARIES = {
  A1: {
    shortLabel: 'Light',
    emoji: '🛩️',
  },
  A2: {
    shortLabel: 'Small',
    emoji: '🛫',
  },
  A3: {
    shortLabel: 'Large',
    emoji: '🛬',
  },
  A4: {
    shortLabel: 'Wake-maker',
    emoji: '🌀',
  },
  A5: {
    shortLabel: 'Heavy',
    emoji: '✈️',
  },
  A6: {
    shortLabel: 'High-perf',
    emoji: '⚡',
  },
  A7: {
    shortLabel: 'Rotorcraft',
    emoji: '🚁',
  },
};

const getCategoryInfo = (rawCode) => {
  if (!rawCode) {
    return null;
  }

  const code = String(rawCode).trim().toUpperCase();
  return CATEGORY_SUMMARIES[code] ?? null;
};

const formatSegment = (segment, originalSegment = segment) => {
  if (!segment) {
    return segment;
  }

  const lower = segment.toLowerCase();
  const original = String(originalSegment);

  if (/[0-9]/.test(lower)) {
    return original.toUpperCase();
  }

  if (lower.length <= 2) {
    return original.toUpperCase();
  }

  return lower[0].toUpperCase() + lower.slice(1);
};

const normalizeWord = (word) => {
  const originalSegments = word.split(/([-/])/);
  const lowerSegments = word.toLowerCase().split(/([-/])/);

  return lowerSegments
    .map((segment, index) => {
      if (segment === '-' || segment === '/') {
        return segment;
      }
      const original = originalSegments[index] ?? segment;
      return formatSegment(segment, original);
    })
    .join('');
};

const formatAircraftDescription = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const result = trimmed
    .split(/\s+/)
    .map((word) => normalizeWord(word))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return result || null;
};

/**
 * Convert a numeric heading to a friendly cardinal direction.
 * @param {number} value - Heading in degrees.
 * @returns {string|null}
 */
const clampBearing = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = ((value % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % cardinalDirections.length;
  return cardinalDirections[index];
};

/**
 * Resolve the most reliable altitude value from a plane object.
 * @param {Record<string, any>} plane
 * @returns {number|null}
 */
const resolveAltitudeFt = (plane) => {
  const candidates = [plane.alt_baro, plane.alt_geom, plane.alt];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

/**
 * Convert the reported ground speed (usually knots) to mph.
 * @param {Record<string, any>} plane
 * @returns {number|null}
 */
const resolveSpeedMph = (plane) => {
  const candidates = [plane.gs, plane.speed, plane.spd];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.round(candidate * KNOTS_TO_MPH);
    }
    if (typeof candidate === 'string' && candidate) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return Math.round(parsed * KNOTS_TO_MPH);
      }
    }
  }
  return null;
};

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

  if (category === 'rotorcraft') {
    if (mph >= 130) {
      return `Chopping through at about ${mph} mph.`;
    }
    if (mph >= 80) {
      return `Cruising the pattern around ${mph} mph.`;
    }
    return `Hovering around ${mph} mph.`;
  }

  if (category === 'high-perf') {
    if (mph >= 300) {
      return `Ripping along near ${mph} mph.`;
    }
    if (mph >= 200) {
      return `Keeping the throttle up around ${mph} mph.`;
    }
    return `Loosening the reins near ${mph} mph.`;
  }

  if (category === 'heavy' || category === 'wake-maker') {
    if (mph >= 300) {
      return `Hauling near ${mph} mph.`;
    }
    if (mph >= 200) {
      return `Rolling near ${mph} mph.`;
    }
    return `Keeping the widebody moving near ${mph} mph.`;
  }

  if (category === 'large') {
    if (mph >= 280) {
      return `Making a brisk pass around ${mph} mph.`;
    }
    if (mph >= 200) {
      return `Keeping the cadence near ${mph} mph.`;
    }
    return `Rolling by around ${mph} mph.`;
  }

  if (category === 'light') {
    if (mph >= 200) {
      return `Scooting near ${mph} mph.`;
    }
    if (mph >= 120) {
      return `Skipping near ${mph} mph.`;
    }
    if (mph >= 60) {
      return `Gliding near ${mph} mph.`;
    }
    return `Loitering near ${mph} mph.`;
  }

  if (category === 'small') {
    if (mph >= 200) {
      return `Pacing near ${mph} mph.`;
    }
    if (mph >= 120) {
      return `Scooting near ${mph} mph.`;
    }
    if (mph >= 60) {
      return `Easy pass near ${mph} mph.`;
    }
    return `Loitering near ${mph} mph.`;
  }

  if (mph >= 300) {
    return `Bolting along near ${mph} mph.`;
  }

  if (mph >= 200) {
    return `Cruising near ${mph} mph.`;
  }

  if (mph >= 120) {
    return `Making good time around ${mph} mph.`;
  }

  if (mph >= 60) {
    return `Taking a leisurely pass around ${mph} mph.`;
  }

  return `Drifting by around ${mph} mph.`;
};

const formatAltitude = (altitude, categoryInfo) => {
  if (!Number.isFinite(altitude) || altitude <= 0) {
    return null;
  }

  const rounded = Math.round(altitude).toLocaleString();
  const category = categoryInfo?.shortLabel
    ? categoryInfo.shortLabel.toLowerCase()
    : null;

  if (category === 'rotorcraft') {
    if (altitude <= 1200) {
      return `Skimming the skyline near ${rounded} ft.`;
    }
    return `Holding above town around ${rounded} ft.`;
  }

  if (category === 'heavy' || category === 'wake-maker') {
    if (altitude >= 30000) {
      return `Stacked way up near ${rounded} ft.`;
    }
    if (altitude >= 20000) {
      return `Cruising that big frame near ${rounded} ft.`;
    }
    if (altitude >= 10000) {
      return `Looming overhead around ${rounded} ft.`;
    }
    return `Low around ${rounded} ft.`;
  }

  if (category === 'high-perf') {
    if (altitude >= 20000) {
      return `Knifing through around ${rounded} ft.`;
    }
    if (altitude >= 10000) {
      return `Slicing the sky near ${rounded} ft.`;
    }
    return `Darting by around ${rounded} ft.`;
  }

  if (category === 'light') {
    if (altitude >= 10000) {
      return `High near ${rounded} ft.`;
    }
    if (altitude >= 5000) {
      return `Mid near ${rounded} ft.`;
    }
    return `Low near ${rounded} ft.`;
  }

  if (category === 'small') {
    if (altitude >= 10000) {
      return `Steady ~${rounded} ft.`;
    }
    if (altitude >= 5000) {
      return `Level ~${rounded} ft.`;
    }
    return `Low ~${rounded} ft.`;
  }

  if (category === 'large') {
    if (altitude >= 20000) {
      return `Cruising solid near ${rounded} ft.`;
    }
    if (altitude >= 10000) {
      return `Keeping a stately perch near ${rounded} ft.`;
    }
    return `Rolling through around ${rounded} ft.`;
  }

  if (altitude >= 30000) {
    return `Way up around ${rounded} ft.`;
  }

  if (altitude >= 20000) {
    return `Cruising high near ${rounded} ft.`;
  }

  if (altitude >= 10000) {
    return `Gliding along around ${rounded} ft.`;
  }

  if (altitude >= 5000) {
    return `Keeping a comfy perch near ${rounded} ft.`;
  }

  return `Keeping it low near ${rounded} ft.`;
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

const variantIndex = (identity, stats, variantsLength) => {
  if (!variantsLength) {
    return 0;
  }

  const codePoint = identity?.codePointAt?.(0) ?? 0;
  const hash = codePoint + stats.total + stats.lastHour * 3;
  return Math.abs(hash) % variantsLength;
};

const truncateMessage = (text, limit = 300) => {
  if (typeof text !== 'string') {
    return '';
  }

  if (limit <= 0) {
    return '';
  }

  if (text.length <= limit) {
    return text;
  }

  const sliceIndex = text.lastIndexOf(' ', limit - 1);
  const endIndex = sliceIndex > 0 ? sliceIndex : limit - 1;
  return `${text.slice(0, endIndex).trimEnd()}…`;
};

const stripTrailingPunctuation = (text) => {
  if (typeof text !== 'string') {
    return text;
  }
  return text.replace(/[\s.!?]+$/u, '').trim();
};

const lowercaseFirst = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return text;
  }
  const trimmed = text.trim();
  return trimmed[0].toLowerCase() + trimmed.slice(1);
};

/**
 * Build a conversational notification title + body for a detected aircraft.
 * @param {Record<string, any>} plane - Raw plane object from airplanes.live.
 * @param {number[]} timestamps - Historical notification timestamps for this plane.
 * @param {number} [now=Date.now()] - Reference timestamp.
 * @returns {{title: string, body: string}}
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
  const operatorPhrase = operatorSentence;
  const frequencySentence = frequencyMessage(stats);

  const intros = ['Can you see it?', 'Look up!', 'There it goes!', 'Up above!'];
  const intro = intros[variantIndex(identity, stats, intros.length)];
  const categoryEmoji = categoryInfo?.emoji ?? '✈️';
  const primaryLine = `${categoryEmoji} ${intro} ${identity} just popped up nearby.`;

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
    operatorPhrase,
  ].filter(Boolean);

  const limit = 280;
  const linkLine = includeDetailsLink ? `📡 <${detailsUrl}>` : null;
  const newlinePadding = linkLine ? 2 : 0;
  const reservedLength = linkLine ? linkLine.length + newlinePadding : 0;
  const prefixReserve =
    linkLine || infoSentences.length || frequencySentence ? 1 : 0;
  const availableLength = Math.max(0, limit - reservedLength - prefixReserve);
  const frequencyReserve =
    frequencySentence && availableLength > 0
      ? frequencySentence.length + (infoSentences.length ? 1 : 0)
      : 0;
  const infoAvailable = Math.max(0, availableLength - frequencyReserve);
  const infoText = infoSentences.join(' ');
  const infoCore = truncateMessage(infoText, infoAvailable);

  let coreMessage = infoCore;
  if (frequencySentence) {
    coreMessage = coreMessage
      ? `${coreMessage} ${frequencySentence}`
      : frequencySentence;
  }

  let body = coreMessage;
  if (linkLine) {
    body = coreMessage ? `${coreMessage}\n\n${linkLine}` : linkLine;
  }
  if (body) {
    body = `\n${body}`;
  }

  return {
    title: primaryLine,
    body,
  };
};

export default {
  summarizeSightings,
  composeNotificationMessage,
};
