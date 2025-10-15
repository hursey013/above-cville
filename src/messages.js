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
  const speedMph = resolveSpeedMph(plane);
  const altitudeFt = resolveAltitudeFt(plane);

  const speedPhrase = formatSpeed(speedMph);
  const altitudePhrase = formatAltitude(altitudeFt);
  const directionPhrase = directionMessage(plane);
  const frequencyPhrase = frequencyMessage(stats);

  const intros = [
    '🌤️ Sky update:',
    '✈️ Airwatch:',
    '👀 Heads up:',
    '📡 Spotter note:',
  ];
  const intro = intros[variantIndex(identity, stats, intros.length)];

  const primaryLine = `${intro} ${identity} just popped up near Charlottesville.`;

  const descriptors = [];
  if (speedPhrase) {
    descriptors.push(`They're ${speedPhrase}.`);
  }
  if (altitudePhrase) {
    descriptors.push(`Currently ${altitudePhrase}.`);
  }
  if (directionPhrase) {
    descriptors.push(directionPhrase);
  }

  const descriptorLine = descriptors.length ? descriptors.join(' ') : null;

  const bodyLines = [primaryLine];
  if (descriptorLine) {
    bodyLines.push(descriptorLine);
  }
  bodyLines.push(frequencyPhrase);

  return {
    title: `${identity} spotted nearby`,
    body: bodyLines.join('\n\n'),
  };
};

export default {
  summarizeSightings,
  composeNotificationMessage,
};
