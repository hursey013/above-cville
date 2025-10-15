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
    summary: '🛩️ Light class (<15,500 lbs).',
  },
  A2: {
    shortLabel: 'Small',
    summary: '🛫 Small class (15,500–75,000 lbs).',
  },
  A3: {
    shortLabel: 'Large',
    summary: '🛬 Large class (75,000–300,000 lbs).',
  },
  A4: {
    shortLabel: 'High vortex',
    summary: '🌀 High vortex large (B757-style wake).',
  },
  A5: {
    shortLabel: 'Heavy',
    summary: '✈️ Heavy class (>300,000 lbs).',
  },
  A6: {
    shortLabel: 'High performance',
    summary: '⚡ High-performance (>5g & 400 kts).',
  },
  A7: {
    shortLabel: 'Rotorcraft',
    summary: '🚁 Rotorcraft (helicopter class).',
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

const formatSpeed = (mph) => {
  if (!Number.isFinite(mph) || mph <= 0) {
    return null;
  }

  if (mph >= 220) {
    return `zipping along around ${mph} mph`;
  }

  if (mph >= 150) {
    return `cruising at roughly ${mph} mph`;
  }

  if (mph >= 90) {
    return `gliding by near ${mph} mph`;
  }

  return `floating in at a relaxed ${mph} mph`;
};

const formatAltitude = (altitude) => {
  if (!Number.isFinite(altitude) || altitude <= 0) {
    return null;
  }

  if (altitude >= 6000) {
    return `soaring high around ${Math.round(altitude).toLocaleString()} ft`;
  }

  if (altitude >= 3000) {
    return `cruising around ${Math.round(altitude).toLocaleString()} ft`;
  }

  if (altitude >= 1500) {
    return `keeping it cozy near ${Math.round(altitude).toLocaleString()} ft`;
  }

  return `skimming low at roughly ${Math.round(altitude).toLocaleString()} ft`;
};

const frequencyMessage = (stats) => {
  if (stats.total <= 1) {
    return "First time we've spotted this one. 👋";
  }

  if (stats.lastHour >= 3) {
    return `They're doing laps — ${stats.lastHour} pings in the last hour!`;
  }

  if (stats.lastDay >= 3) {
    return `Busy day: ${stats.lastDay} flybys today.`;
  }

  if (stats.lastWeek >= 3) {
    return `Regular visitor — ${stats.lastWeek} sightings this week.`;
  }

  if (stats.averageIntervalMs && stats.averageIntervalMs < DAY_MS) {
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
      return `Heading ${cardinal}.`;
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

const selectFacts = (facts, seed) => {
  if (!Array.isArray(facts) || !facts.length) {
    return [];
  }

  const count = Math.min(facts.length, 2);
  const start = seed % facts.length;
  const selected = [];

  for (let index = 0; index < count; index += 1) {
    selected.push(facts[(start + index) % facts.length]);
  }

  return selected;
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

  const description = formatAircraftDescription(plane.desc);
  const categoryInfo =
    getCategoryInfo(plane.category ?? plane.cat) ?? undefined;
  const categoryLine = categoryInfo?.summary ?? null;

  const dbFlagsRaw =
    typeof plane.dbFlags === 'string' ? plane.dbFlags.trim() : '';
  const isMilitary = dbFlagsRaw.startsWith('1');
  const isInteresting = dbFlagsRaw.length > 1 && dbFlagsRaw[1] === '1';
  const operatorName =
    dbFlagsRaw && plane.ownOp ? formatAircraftDescription(plane.ownOp) : null;
  const militaryLine = isMilitary ? '🛡️ Military traffic.' : null;
  const interestingLine = isInteresting
    ? '👀 Marked as interesting traffic.'
    : null;
  const operatorLine = operatorName ? `Operated by ${operatorName}.` : null;

  const speedPhrase = formatSpeed(resolveSpeedMph(plane));
  const altitudePhrase = formatAltitude(resolveAltitudeFt(plane));
  const directionLine = directionMessage(plane);
  const frequencyLine = frequencyMessage(stats);

  const intros = [
    '🌤️ Sky update:',
    '✈️ Airwatch:',
    '👀 Heads up:',
    '📡 Spotter note:',
  ];
  const intro = intros[variantIndex(identity, stats, intros.length)];
  const primaryLine = `${intro} ${identity} just popped up near Charlottesville.`;

  const descriptionLine = description
    ? `Meet ${description}${
        categoryInfo ? ` (${categoryInfo.shortLabel})` : ''
      }.`
    : null;

  const speedLine = speedPhrase ? `They're ${speedPhrase}.` : null;
  const altitudeLine = altitudePhrase ? `Currently ${altitudePhrase}.` : null;

  const optionalFacts = [categoryLine, speedLine, altitudeLine].filter(Boolean);
  const variantSeed = optionalFacts.length
    ? variantIndex(identity, stats, optionalFacts.length)
    : 0;
  const selectedOptionalFacts = selectFacts(optionalFacts, variantSeed);

  const factLines = [];
  if (militaryLine) {
    factLines.push(militaryLine);
  }
  if (interestingLine) {
    factLines.push(interestingLine);
  }
  if (operatorLine) {
    factLines.push(operatorLine);
  }
  if (directionLine) {
    factLines.push(directionLine);
  }
  factLines.push(...selectedOptionalFacts);

  const bodyLines = [
    primaryLine,
    descriptionLine,
    ...factLines,
    frequencyLine,
  ].filter(Boolean);

  const linkBase = config.aircraftLinkBase;
  const hex = plane.hex ? String(plane.hex).toLowerCase() : null;
  const detailsUrl = hex && linkBase ? `${linkBase}${hex}` : null;

  const limit = 300;
  const newlinePadding = detailsUrl && bodyLines.length ? 2 : 0;
  const reservedLength = detailsUrl ? detailsUrl.length + newlinePadding : 0;
  const availableLength = Math.max(0, limit - reservedLength);

  const coreMessage = truncateMessage(bodyLines.join('\n\n'), availableLength);

  const body = detailsUrl
    ? coreMessage
      ? `${coreMessage}\n\n${detailsUrl}`
      : detailsUrl
    : coreMessage;

  return {
    title: `${identity} spotted nearby`,
    body,
  };
};

export default {
  summarizeSightings,
  composeNotificationMessage,
};
