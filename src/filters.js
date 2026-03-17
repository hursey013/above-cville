/**
 * Utility helpers for deciding whether a plane should be ignored before it ever
 * reaches notification logic.
 *
 * The functions in this module are intentionally small and free of side
 * effects, making them easy to reason about and test in isolation.
 */

/**
 * Determine whether a plane should be ignored based on its callsign prefix.
 *
 * @param {unknown} flightRaw - Raw flight string from the API.
 * @param {string[]} ignoredCarrierCodes - Uppercase carrier codes to ignore.
 * @returns {boolean} True when the plane should be skipped.
 */
export const shouldIgnoreCarrier = (flightRaw, ignoredCarrierCodes = []) => {
  if (!Array.isArray(ignoredCarrierCodes) || ignoredCarrierCodes.length === 0) {
    return false;
  }

  if (typeof flightRaw !== 'string') {
    return false;
  }

  const callsign = flightRaw.trim().toUpperCase();
  if (!callsign) {
    return false;
  }

  return ignoredCarrierCodes.some((code) => callsign.startsWith(code));
};

export default {
  shouldIgnoreCarrier,
};
