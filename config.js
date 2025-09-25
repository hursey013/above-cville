"use strict";

require("dotenv").config();

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = value =>
  value
    ? value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
    : [];

const stripTrailingSlash = value =>
  value && value.endsWith("/") ? value.slice(0, -1) : value;

module.exports = {
  actionPhrases: [
    "Can you see it?",
    "Look up!",
    "There it goes!",
    "Up above!"
  ],
  refreshSeconds: parseNumber(process.env.REFRESH_SECONDS, 5),
  cooldownMinutes: parseNumber(process.env.COOLDOWN_MINUTES, 10),
  maximumAlt: parseNumber(process.env.MAXIMUM_ALT, 25000),
  photoApi: {
    username: process.env.PHOTO_API_USERNAME,
    password: process.env.PHOTO_API_PASSWORD,
    url: stripTrailingSlash(process.env.PHOTO_API_URL || "https://fa-photo-api.web.app")
  },
  abbreviations: ["IAI", "II", "III", "LLC", "PHI", "PSA", "TT", "XLS"],
  articles: {
    A: ["Eurocopter"],
    An: []
  },
  airplanesLive: {
    url: stripTrailingSlash(
      process.env.AIRPLANES_LIVE_URL || "https://api.airplanes.live/v2"
    ),
    lat: parseNumber(process.env.AIRPLANES_LIVE_LAT, 38.0375),
    lon: parseNumber(process.env.AIRPLANES_LIVE_LON, -78.4863),
    radius: parseNumber(process.env.AIRPLANES_LIVE_RADIUS, 25),
    key: process.env.AIRPLANES_LIVE_KEY
  },
  pocketbase: {
    baseUrl: stripTrailingSlash(
      process.env.POCKETBASE_URL || "http://pocketbase:8090"
    ),
    statesCollection: process.env.POCKETBASE_STATES_COLLECTION || "states",
    ignoredCollection: process.env.POCKETBASE_IGNORED_COLLECTION || "ignored",
    operatorsCollection:
      process.env.POCKETBASE_OPERATORS_COLLECTION || "operators",
    adminEmail: process.env.POCKETBASE_ADMIN_EMAIL,
    adminPassword: process.env.POCKETBASE_ADMIN_PASSWORD,
    adminToken: process.env.POCKETBASE_ADMIN_TOKEN,
    requestTimeout: parseNumber(process.env.POCKETBASE_TIMEOUT, 10000),
    cacheTtlMs:
      parseNumber(process.env.POCKETBASE_CACHE_TTL_SECONDS, 300) * 1000
  },
  apprise: {
    url: stripTrailingSlash(process.env.APPRISE_URL || "http://apprise:8000/notify"),
    targets: parseList(process.env.APPRISE_TARGETS),
    tag: process.env.APPRISE_TAG,
    timeout: parseNumber(process.env.APPRISE_TIMEOUT, 10000)
  },
  healthcheckUrl: stripTrailingSlash(process.env.HEALTHCHECK_URL || "")
};
