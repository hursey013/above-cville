"use strict";

const https = require("https");
const { serializeError } = require("serialize-error");

const {
  airplanesLive: { url, lat, lon, radius, key },
  cooldownMinutes,
  healthcheckUrl,
  photoApi
} = require("./config");
const {
  createStatus,
  filterStates,
  formatIdentifier,
  formatType,
  isNewState
} = require("./utils");
const pocketbaseService = require("./services/pocketbase");
const { sendNotification } = require("./services/notifications");
const { HttpError, request } = require("./services/http");

const fetchStates = () => {
  const headers = { "Accept-Encoding": "gzip" };

  if (key) {
    headers["X-API-Key"] = key;
  }

  return request({
    baseUrl: url,
    path: `/point/${lat}/${lon}/${radius}`,
    headers
  });
};

const fetchMediaLink = async state => {
  const { url, username, password } = photoApi;
  const query = state.r || (state.flight && state.flight.trim());

  if (!url || !query) return null;

  try {
    const headers = {};

    if (username && password) {
      const token = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    const data = await request({
      url,
      params: { reg: query },
      headers
    });

    const photos = (data && data.photos) || [];
    const links = (data && data.links) || [];
    return links[0] || photos[0] || null;
  } catch (error) {
    console.warn(
      `Photo lookup failed for ${query}: ${JSON.stringify(serializeError(error))}`
    );
    return null;
  }
};

const buildNotificationTitle = state => {
  const typeLabel = formatType(state.t).trim();
  const cleanedType = typeLabel.replace(/^(An?|A)\s+/i, "");
  const identifier = formatIdentifier(state.flight, state.r, state.dbFlags);
  const fallback = state.hex ? `#${state.hex}` : "";
  const id = identifier ? identifier.trim() : fallback;

  if (cleanedType && cleanedType.toLowerCase() !== "aircraft") {
    return `Aircraft spotted: ${cleanedType}${id ? ` ${id}` : ""}`;
  }

  return id
    ? `Aircraft spotted: ${id}`
    : "Aircraft spotted over Charlottesville";
};

const handleState = async (state, time, operatorsSnapshot) => {
  try {
    const { record, snapshot } = await pocketbaseService.fetchState(state.hex);

    if (!isNewState(snapshot, cooldownMinutes)) {
      return false;
    }

    console.info(JSON.stringify(state));

    await pocketbaseService.saveTimestamp(state.hex, time, record);

    const mediaLink = await fetchMediaLink(state);
    const status = createStatus(snapshot, state, operatorsSnapshot, mediaLink);
    const title = buildNotificationTitle(state);

    await sendNotification({ title, body: status, media: mediaLink });

    return true;
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `State processing failed for ${state.hex}: ${JSON.stringify({
          status: error.status,
          data: error.data
        })}`
      );
      return false;
    }

    console.error(
      `State processing failed for ${state.hex}: ${JSON.stringify(
        serializeError(error)
      )}`
    );
    return false;
  }
};

const app = async () => {
  try {
    const { ac: states, ctime, now, time: reportedTime } = await fetchStates();
    const time = ctime || now || reportedTime || Date.now();

    if (!Array.isArray(states) || states.length === 0) return false;

    const [ignored, operatorsSnapshot] = await Promise.all([
      pocketbaseService.getIgnoredOperatorsSnapshot(),
      pocketbaseService.getOperatorsSnapshot()
    ]);

    await Promise.all(
      filterStates(states, ignored).map(state =>
        handleState(state, time, operatorsSnapshot)
      )
    );

    return true;
  } catch (error) {
    console.error(JSON.stringify(serializeError(error)));
    return false;
  } finally {
    if (healthcheckUrl) {
      https
        .get(healthcheckUrl)
        .on("error", err => console.warn(`Ping failed: ${err.message}`));
    }
  }
};

module.exports = app;
module.exports.buildNotificationTitle = buildNotificationTitle;
