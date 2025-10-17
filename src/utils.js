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

export const CATEGORY_SUMMARIES = {
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

/**
 * Map a raw category code to its summary metadata.
 * @param {unknown} rawCode
 * @returns {{shortLabel:string, emoji:string}|null}
 */
export const getCategoryInfo = (rawCode) => {
  if (!rawCode) {
    return null;
  }
  const code = String(rawCode).trim().toUpperCase();
  return CATEGORY_SUMMARIES[code] ?? null;
};

/**
 * Convert a numeric heading into a cardinal direction string.
 * @param {number} value
 * @returns {string|null}
 */
export const clampBearing = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = ((value % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % cardinalDirections.length;
  return cardinalDirections[index];
};

const APPROXIMATION_WORDS = ['around', 'near', 'about', 'roughly'];
const normalizeString = (value) => value?.toString?.().trim?.() ?? '';

/**
 * Parse a numeric environment variable, falling back when parsing fails.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Extract a trimmed string or return an empty string.
 * @param {unknown} value
 * @returns {string}
 */
export const parseString = (value) =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Split a comma/newline separated list into individual trimmed items.
 * @param {unknown} value
 * @returns {string[]}
 */
export const parseStringList = (value) =>
  (value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Uppercase each entry in a list, applying a fallback string when nothing is
 * provided.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string[]}
 */
export const parseUpperStringList = (value, fallback) =>
  parseStringList(value ?? fallback).map((item) => item.toUpperCase());

/**
 * Clamp a poll interval to a positive integer number of seconds.
 * @param {unknown} value
 * @returns {number}
 */
export const clampSeconds = (value) => {
  const seconds = Math.round(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
};

/**
 * Normalise aircraft registrations to uppercase without surrounding whitespace.
 * @param {unknown} value
 * @returns {string}
 */
export const normalizeRegistration = (value) => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : '';
};

/**
 * Normalise ICAO hex identifiers to lowercase without surrounding whitespace.
 * @param {unknown} value
 * @returns {string}
 */
export const normalizeHex = (value) => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : '';
};
const KNOTS_TO_MPH = 1.15078;

/**
 * Create a helper that chooses varied approximation words while avoiding
 * repetition inside a single message.
 * @returns {(preferred?:string[]|string)=>string}
 */
export const createApproxWordPicker = () => {
  const used = new Set();
  return (preferred) => {
    const candidates =
      Array.isArray(preferred) && preferred.length
        ? preferred
        : APPROXIMATION_WORDS;

    for (const candidate of candidates) {
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }

    for (const fallback of APPROXIMATION_WORDS) {
      if (!used.has(fallback)) {
        used.add(fallback);
        return fallback;
      }
    }

    return candidates[0] ?? APPROXIMATION_WORDS[0];
  };
};

/**
 * Choose an approximation word using the provided picker, falling back to a
 * sensible default when the picker cannot be called.
 * @param {(preferred?:string[]|string)=>string} [picker]
 * @param {string[]|string} [preferred]
 * @returns {string}
 */
export const resolveApproxWord = (picker, preferred) => {
  if (typeof picker !== 'function') {
    const candidates =
      Array.isArray(preferred) && preferred.length
        ? preferred
        : APPROXIMATION_WORDS;
    return candidates[0] ?? APPROXIMATION_WORDS[0];
  }
  return picker(preferred);
};

/**
 * Evaluate a list of template descriptors and return the first matching string.
 * @param {number} value
 * @param {{test:(value:number)=>boolean,template:(value:number, pick:(preferred?:string[]|string)=>string)=>string}[]} templates
 * @param {(preferred?:string[]|string)=>string} [pickApproxWord]
 * @returns {string|null}
 */
export const matchTemplate = (value, templates, pickApproxWord) => {
  if (!Array.isArray(templates)) {
    return null;
  }
  for (const { test, template } of templates) {
    if (test(value)) {
      return template(value, pickApproxWord);
    }
  }
  return null;
};

/**
 * Format a numeric altitude in feet with locale-aware thousands separators.
 * @param {number} value
 * @returns {string}
 */
export const formatFeet = (value) => Math.round(value).toLocaleString();

/**
 * Convert reported ground speed (usually knots) to mph.
 * @param {Record<string, unknown>} plane
 * @returns {number|null}
 */
export const resolveSpeedMph = (plane) => {
  const candidates = [plane?.gs, plane?.speed, plane?.spd];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.round(candidate * KNOTS_TO_MPH);
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate.trim());
      if (Number.isFinite(parsed)) {
        return Math.round(parsed * KNOTS_TO_MPH);
      }
    }
  }
  return null;
};

/**
 * Deterministic selector used to vary messaging based on identity + stats.
 * @param {string} identity
 * @param {{total:number,lastHour:number}} stats
 * @param {number} variantsLength
 * @returns {number}
 */
export const variantIndex = (identity, stats, variantsLength) => {
  if (!variantsLength) {
    return 0;
  }
  const codePoint = identity?.codePointAt?.(0) ?? 0;
  const hash = codePoint + stats.total + stats.lastHour * 3;
  return Math.abs(hash) % variantsLength;
};

/**
 * Capitalise alpha-numeric segments while preserving separators.
 * @param {string} segment
 * @param {string} originalSegment
 * @returns {string}
 */
export const formatSegment = (segment, originalSegment = segment) => {
  if (!segment) {
    return segment;
  }

  const lower = segment.toLowerCase();
  const original = String(originalSegment);

  if (/[0-9]/.test(lower) || lower.length <= 2) {
    return original.toUpperCase();
  }

  return lower[0].toUpperCase() + lower.slice(1);
};

/**
 * Normalise a word that may contain separators like '-' or '/'.
 * @param {string} word
 * @returns {string}
 */
export const normalizeWord = (word) => {
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

/**
 * Tidy an aircraft description, normalising casing and whitespace.
 * @param {unknown} value
 * @returns {string|null}
 */
export const formatAircraftDescription = (value) => {
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
 * Trim trailing punctuation to make fragments easier to stitch.
 * @param {string} text
 * @returns {string}
 */
export const stripTrailingPunctuation = (text) => {
  if (typeof text !== 'string') {
    return text;
  }
  return text.replace(/[\s.!?]+$/u, '').trim();
};

/**
 * Lowercase only the first character of a string.
 * @param {string} text
 * @returns {string}
 */
export const lowercaseFirst = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return text;
  }
  const trimmed = text.trim();
  return trimmed[0].toLowerCase() + trimmed.slice(1);
};

/**
 * Truncate text on word boundaries, appending an ellipsis when needed.
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
export const truncateMessage = (text, limit = 300) => {
  if (typeof text !== 'string' || limit <= 0) {
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
 * Remove redundant trailing slashes from a URL or path string.
 * @param {unknown} value - Input value that may contain excess trailing slashes.
 * @returns {string}
 */
export const trimTrailingSlash = (value = '') => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = value.toString();
  return stringValue.replace(/\/+$/, '');
};

/**
 * Resolve the best numeric altitude for a plane, prioritising barometric readouts.
 * @param {Record<string, any>} plane - Raw plane object from airplanes.live.
 * @returns {number|null} Altitude in feet or null when it cannot be parsed.
 */
export const resolveAltitudeFt = (plane) => {
  const altitudeCandidates = [plane?.alt_baro, plane?.alt_geom, plane?.alt];

  for (const candidate of altitudeCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

/**
 * Determine whether an aircraft should be skipped because it is effectively on the ground.
 * @param {Record<string, any>} plane - Raw plane object.
 * @returns {boolean}
 */
export const isGrounded = (plane) => {
  const altitudeRaw = plane?.alt_baro;
  return (
    typeof altitudeRaw === 'string' &&
    altitudeRaw.trim().toLowerCase() === 'ground'
  );
};

/**
 * Evaluate whether an altitude exceeds the configured maximum.
 * @param {number|null} altitudeFt - Altitude in feet.
 * @param {number} ceilingFt - Configured maximum altitude.
 * @returns {boolean}
 */
export const isAboveConfiguredCeiling = (altitudeFt, ceilingFt) => {
  if (!Number.isFinite(ceilingFt) || ceilingFt <= 0) {
    return false;
  }

  return typeof altitudeFt === 'number' && altitudeFt > ceilingFt;
};

export default {
  clampSeconds,
  createApproxWordPicker,
  CATEGORY_SUMMARIES,
  clampBearing,
  formatFeet,
  formatAircraftDescription,
  formatSegment,
  getCategoryInfo,
  isAboveConfiguredCeiling,
  isGrounded,
  matchTemplate,
  lowercaseFirst,
  normalizeRegistration,
  normalizeHex,
  normalizeWord,
  parseNumber,
  parseString,
  parseStringList,
  parseUpperStringList,
  resolveApproxWord,
  resolveAltitudeFt,
  resolveSpeedMph,
  stripTrailingPunctuation,
  trimTrailingSlash,
  truncateMessage,
  variantIndex,
};
