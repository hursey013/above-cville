/**
 * Utility helpers for deciding whether a plane should be ignored before it ever
 * reaches notification logic.
 *
 * The functions in this module are intentionally small and free of side
 * effects, making them easy to reason about and test in isolation.
 */

/**
 * Extract the three-letter carrier code from a flight callsign (e.g. "UAL123").
 *
 * @param {unknown} flightRaw - Raw flight string from the API.
 * @returns {string|null} Uppercase carrier code or null when the callsign is unusable.
 */
export const getCarrierCode = (flightRaw) => {
  if (typeof flightRaw !== 'string') {
    return null;
  }

  const callsign = flightRaw.trim();
  if (callsign.length < 3) {
    return null;
  }

  return callsign.slice(0, 3).toUpperCase();
};

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

  const carrierCode = getCarrierCode(flightRaw);
  if (!carrierCode) {
    return false;
  }

  return ignoredCarrierCodes.includes(carrierCode);
};

export default {
  getCarrierCode,
  shouldIgnoreCarrier
};
