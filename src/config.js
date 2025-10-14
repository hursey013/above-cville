import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseStringList = (value) =>
  (value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseUpperStringList = (value, fallback) =>
  parseStringList(value ?? fallback).map((item) => item.toUpperCase());

const clampSeconds = (value) => {
  const seconds = Math.round(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
};

export const config = {
  latitude: parseNumber(process.env.AIRPLANES_LAT, 38.0375),
  longitude: parseNumber(process.env.AIRPLANES_LON, -78.4863),
  radius: parseNumber(process.env.AIRPLANES_RADIUS, 2.5),
  pollIntervalSeconds: clampSeconds(parseNumber(process.env.POLL_INTERVAL_SECONDS, 5)),
  cooldownMinutes: Math.max(1, parseNumber(process.env.COOLDOWN_MINUTES, 10)),
  maxAltitudeFt: parseNumber(process.env.MAX_ALTITUDE_FT, 25000),
  ignoredCarrierCodes: parseUpperStringList(
    process.env.IGNORE_CARRIERS,
    ''
  ),
  apprise: {
    apiUrl: process.env.APPRISE_API_URL ?? 'http://apprise:8000/notify',
    urls: parseStringList(process.env.APPRISE_URLS),
    configKey: parseString(process.env.APPRISE_CONFIG_KEY)
  },
  dataFile: process.env.DATA_FILE ?? 'data/db.json'
};

export default config;
