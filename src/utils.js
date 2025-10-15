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
  trimTrailingSlash,
  resolveAltitudeFt,
  isGrounded,
  isAboveConfiguredCeiling,
};
