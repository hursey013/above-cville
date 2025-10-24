/**
 * Application configuration loader. Values are normalised from the process
 * environment with sensible defaults so the rest of the codebase can assume
 * consistent types.
 */
import dotenv from 'dotenv';

import {
  clampSeconds,
  parseNumber,
  parseString,
  parseUpperStringList,
} from './utils.js';

dotenv.config();

/**
 * Fully resolved configuration used by the running application.
 */
export const config = {
  latitude: parseNumber(process.env.AIRPLANES_LAT, 38.0375),
  longitude: parseNumber(process.env.AIRPLANES_LON, -78.4863),
  radius: parseNumber(process.env.AIRPLANES_RADIUS, 5),
  pollIntervalSeconds: clampSeconds(
    parseNumber(process.env.POLL_INTERVAL_SECONDS, 5),
  ),
  cooldownMinutes: Math.max(1, parseNumber(process.env.COOLDOWN_MINUTES, 10)),
  maxAltitudeFt: parseNumber(process.env.MAX_ALTITUDE_FT, 25000),
  ignoredCarrierCodes: parseUpperStringList(process.env.IGNORE_CARRIERS, ''),
  aircraftLinkBase:
    parseString(process.env.AIRCRAFT_LINK_BASE) ||
    'https://globe.airplanes.live/?icao=',
  showDetailsLink:
    parseString(process.env.SHOW_DETAILS_LINK).toLowerCase() !== 'false',
  planespotters: {
    apiKey: parseString(process.env.PLANESPOTTERS_API_KEY),
  },
  healthchecks: {
    pingUrl: parseString(process.env.HEALTHCHECKS_PING_URL),
  },
  bluesky: {
    service: parseString(process.env.BLUESKY_SERVICE) || 'https://bsky.social',
    handle: parseString(process.env.BLUESKY_HANDLE),
    appPassword: parseString(process.env.BLUESKY_APP_PASSWORD),
  },
  dataFile: process.env.DATA_FILE ?? 'data/db.json',
};

export default config;
