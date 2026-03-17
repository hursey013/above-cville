import logger from './logger.js';
import { trimTrailingSlash } from './utils.js';

const AIRPLANES_LIVE_SOURCE = 'airplanes.live';
const LOCAL_READSB_SOURCE = 'readsb';

const AIRPLANES_LIVE_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'above-cville/2.0.0 (+https://github.com/hursey013/above-cville)',
};

// Accept a couple of forgiving aliases for self-hosters, but normalize quickly
// so the rest of the code only deals with two source names.
const resolveSourceName = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (
    !normalized ||
    normalized === 'airplanes.live' ||
    normalized === 'airplanes_live' ||
    normalized === 'airplanes-live'
  ) {
    return AIRPLANES_LIVE_SOURCE;
  }

  if (
    normalized === 'readsb' ||
    normalized === 'local' ||
    normalized === 'local-api' ||
    normalized === 'local_api'
  ) {
    return LOCAL_READSB_SOURCE;
  }

  throw new Error(
    `Unsupported aircraft API source "${value}". Expected "airplanes.live" or "readsb".`,
  );
};

const buildAirplanesLiveUrl = ({ baseUrl, latitude, longitude, radius }) =>
  `${trimTrailingSlash(baseUrl)}/point/${latitude}/${longitude}/${radius}`;

const buildReadsbUrl = ({ baseUrl, latitude, longitude, radius }) =>
  `${trimTrailingSlash(baseUrl)}?circle=${latitude},${longitude},${radius}`;

// readsb tends to use `r` for registration, while the rest of the app prefers
// a clearer `registration` field. Keep both so downstream code can stay simple.
const normalizeReadsbPlane = (plane) => {
  if (!plane || typeof plane !== 'object') {
    return plane;
  }

  const registration =
    typeof plane.r === 'string' && plane.r.trim() ? plane.r.trim() : null;

  return {
    ...plane,
    registration: plane.registration ?? registration,
  };
};

const readErrorBody = async (response) => {
  try {
    const body = await response.text();
    return typeof body === 'string' && body.trim() ? body.trim() : null;
  } catch {
    return null;
  }
};

const fetchAirplanesLiveSnapshot = async ({
  baseUrl,
  latitude,
  longitude,
  radius,
}) => {
  const url = buildAirplanesLiveUrl({ baseUrl, latitude, longitude, radius });
  const response = await fetch(url, {
    headers: AIRPLANES_LIVE_HEADERS,
  });

  if (!response.ok) {
    const responseBody = await readErrorBody(response);
    throw new Error(
      `airplanes.live responded with status ${response.status} for ${url}${responseBody ? `: ${responseBody}` : ''}`,
    );
  }

  const payload = await response.json();
  const aircraft = Array.isArray(payload?.ac) ? payload.ac : [];

  return {
    source: AIRPLANES_LIVE_SOURCE,
    aircraft,
  };
};

const fetchReadsbSnapshot = async ({
  baseUrl,
  latitude,
  longitude,
  radius,
}) => {
  const url = buildReadsbUrl({ baseUrl, latitude, longitude, radius });
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const responseBody = await readErrorBody(response);
    throw new Error(
      `readsb API responded with status ${response.status} for ${url}${responseBody ? `: ${responseBody}` : ''}`,
    );
  }

  const payload = await response.json();
  const rawAircraft = Array.isArray(payload?.aircraft) ? payload.aircraft : [];
  const aircraft = rawAircraft.map(normalizeReadsbPlane);

  logger.info(
    {
      source: LOCAL_READSB_SOURCE,
      url,
      aircraftCount: aircraft.length,
    },
    'Fetched readsb aircraft snapshot',
  );

  return {
    source: LOCAL_READSB_SOURCE,
    aircraft,
  };
};

/**
 * Fetch one snapshot from the configured aircraft source.
 * The returned shape is intentionally small: { source, aircraft }.
 */
export const fetchAircraftSnapshot = async ({
  source,
  baseUrl,
  latitude,
  longitude,
  radius,
}) => {
  const resolvedSource = resolveSourceName(source);

  if (resolvedSource === AIRPLANES_LIVE_SOURCE) {
    return fetchAirplanesLiveSnapshot({
      baseUrl,
      latitude,
      longitude,
      radius,
    });
  }

  return fetchReadsbSnapshot({
    baseUrl,
    latitude,
    longitude,
    radius,
  });
};

export {
  AIRPLANES_LIVE_SOURCE,
  LOCAL_READSB_SOURCE,
  buildReadsbUrl,
  normalizeReadsbPlane,
  resolveSourceName,
};
