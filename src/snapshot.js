import logger from './logger.js';
import { trimTrailingSlash } from './utils.js';

const READSB_HEADERS = {
  Accept: 'application/json',
};

export const buildReadsbUrl = ({ baseUrl, latitude, longitude, radius }) =>
  `${trimTrailingSlash(baseUrl)}?circle=${latitude},${longitude},${radius}`;

// readsb tends to use `r` for registration, while the rest of the app prefers
// a clearer `registration` field. Keep both so downstream code can stay simple.
export const normalizeReadsbPlane = (plane) => {
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

/**
 * Fetch one traffic snapshot from the local readsb API.
 * The returned shape is intentionally small: { aircraft }.
 */
export const fetchAircraftSnapshot = async ({
  baseUrl,
  latitude,
  longitude,
  radius,
}) => {
  const url = buildReadsbUrl({ baseUrl, latitude, longitude, radius });
  const response = await fetch(url, {
    headers: READSB_HEADERS,
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
      source: 'readsb',
      url,
      aircraftCount: aircraft.length,
    },
    'Fetched readsb aircraft snapshot',
  );

  return { aircraft };
};
