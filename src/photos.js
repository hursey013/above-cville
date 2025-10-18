/**
 * Utilities to locate aircraft imagery from external providers, with caching and
 * graceful fallbacks. The fetch order is:
 *   1. FlightAware (registration-based HTML scrape)
 *   2. Planespotters (authenticated JSON API; hex)
 */

import config from './config.js';
import logger from './logger.js';
import { normalizeHex, normalizeRegistration } from './utils.js';

const FLIGHTAWARE_BASE = 'https://www.flightaware.com/photos/aircraft';
const FLIGHTAWARE_SORT_SUFFIX = '/sort/date';
const DEFAULT_IMAGE = 'https://www.flightaware.com/images/og_default_image.png';

const PLANESPOTTERS_API_BASE = 'https://api.planespotters.net/v1/photos';
const PLANESPOTTERS_PAGE_BASE = 'https://www.planespotters.net/photos/reg';

// -- FlightAware helpers ----------------------------------------------------

/** Cache of raw FlightAware scrapes keyed by registration. */
const flightAwareCache = new Map();
// -- Planespotters helpers --------------------------------------------------

/** Cache of Planespotters API responses keyed by `${identifier}:${registration}`. */
const planespottersCache = new Map();
/** Cache of the aggregated photo result, keyed by registration and/or hex. */
const photoResultCache = new Map();

/**
 * Build the canonical FlightAware gallery URL for a registration.
 * @param {string|undefined|null} registration
 * @returns {string|null}
 */
export const buildPlanePhotoPageUrl = (registration) => {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return null;
  }
  return `${FLIGHTAWARE_BASE}/${encodeURIComponent(normalized)}`;
};

/**
 * Extract the OpenGraph image reference from a FlightAware gallery page.
 * @param {string} html
 * @returns {string|null}
 */
const extractOgImage = (html) => {
  if (typeof html !== 'string' || !html) {
    return null;
  }

  const metaRegex = /<meta\s+(?:[^>]*?\s)?property=["']og:image["'][^>]*>/i;
  const match = html.match(metaRegex);
  if (!match) {
    return null;
  }

  const contentRegex = /content=["']([^"']+)["']/i;
  const contentMatch = match[0].match(contentRegex);
  if (!contentMatch) {
    return null;
  }

  const url = contentMatch[1].trim();
  if (!url || url === DEFAULT_IMAGE) {
    return null;
  }

  return url;
};

/**
 * Resolve the most recent FlightAware photo URL for a registration.
 * @param {string|null} registration - Uppercase registration identifier.
 * @returns {Promise<string|null>}
 */
const fetchFlightAwarePhoto = async (registration) => {
  if (!registration) {
    return null;
  }

  if (flightAwareCache.has(registration)) {
    return flightAwareCache.get(registration);
  }

  const pageUrl = `${FLIGHTAWARE_BASE}/${encodeURIComponent(
    registration,
  )}${FLIGHTAWARE_SORT_SUFFIX}`;

  logger.info(
    { source: 'flightaware', registration, url: pageUrl },
    'Requesting FlightAware photo',
  );

  try {
    const response = await fetch(pageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      logger.warn(
        {
          source: 'flightaware',
          registration,
          status: response.status,
          url: pageUrl,
        },
        'FlightAware photo request failed',
      );
      flightAwareCache.set(registration, null);
      return null;
    }

    const html = await response.text();
    const imageUrl = extractOgImage(html);
    logger.info(
      {
        source: 'flightaware',
        registration,
        status: response.status,
        url: pageUrl,
        foundImage: Boolean(imageUrl),
        htmlPreview: html.slice(0, 200),
      },
      'FlightAware photo response received',
    );
    flightAwareCache.set(registration, imageUrl ?? null);
    return imageUrl ?? null;
  } catch (error) {
    logger.warn(
      {
        source: 'flightaware',
        registration,
        url: pageUrl,
        err: error,
      },
      'Failed to fetch FlightAware photo',
    );
    flightAwareCache.set(registration, null);
    return null;
  }
};

/**
 * Normalise Planespotters photo payloads into the shared result shape.
 * @param {any} payload
 * @param {string|null} registration
 * @returns {{imageUrl:string,pageUrl:string|null}|null}
 */
const resolvePlanespottersPhoto = (payload, registration) => {
  const photos = Array.isArray(payload?.photos) ? payload.photos : [];
  for (const photo of photos) {
    if (!photo || typeof photo !== 'object') {
      continue;
    }
    let resolvedRegistration = registration;
    if (!resolvedRegistration) {
      const registrationCandidate =
        typeof photo.registration === 'string' && photo.registration.trim()
          ? photo.registration.trim()
          : null;
      resolvedRegistration = registrationCandidate
        ? normalizeRegistration(registrationCandidate)
        : null;
    }

    const imageCandidate = (() => {
      const large = photo?.thumbnail_large;
      if (large && typeof large === 'object' && typeof large.src === 'string') {
        const trimmed = large.src.trim();
        if (trimmed) {
          return trimmed;
        }
      }
      const thumb = photo?.thumbnail;
      if (thumb && typeof thumb === 'object' && typeof thumb.src === 'string') {
        const trimmed = thumb.src.trim();
        if (trimmed) {
          return trimmed;
        }
      }
      return null;
    })();

    if (!imageCandidate) {
      continue;
    }

    const pageUrl = resolvedRegistration
      ? buildPlanespottersPhotoPageUrl(resolvedRegistration)
      : null;

    return {
      imageUrl: imageCandidate,
      pageUrl,
    };
  }
  return null;
};

/**
 * Build the canonical Planespotters gallery URL for a registration.
 * @param {string|null} registration
 * @returns {string|null}
 */
const buildPlanespottersPhotoPageUrl = (registration) => {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return null;
  }
  return `${PLANESPOTTERS_PAGE_BASE}/${encodeURIComponent(normalized)}`;
};

/**
 * Query the authenticated Planespotters API using the `/hex` endpoint.
 * @param {{identifier:string,registration:string|null,apiKey:string}} params
 * @returns {Promise<{imageUrl:string,pageUrl:string|null}|null>}
 */
const fetchPlanespottersByHex = async ({
  identifier,
  registration,
  apiKey,
}) => {
  if (!identifier || !apiKey) {
    return null;
  }

  const cacheKey = `${identifier}:${registration ?? ''}`;
  if (planespottersCache.has(cacheKey)) {
    return planespottersCache.get(cacheKey);
  }

  const url = new URL(
    `${PLANESPOTTERS_API_BASE}/hex/${encodeURIComponent(identifier)}`,
  );
  if (registration) {
    url.searchParams.set('reg', registration);
  }

  try {
    logger.info(
      {
        source: 'planespotters',
        identifier,
        registration,
        url: url.toString(),
      },
      'Requesting Planespotters photo',
    );
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'x-auth-token': apiKey,
      },
    });
    if (!response.ok) {
      logger.warn(
        {
          source: 'planespotters',
          identifier,
          registration,
          status: response.status,
          url: url.toString(),
        },
        'Planespotters request failed',
      );
      planespottersCache.set(cacheKey, null);
      return null;
    }

    const payload = await response.json();
    const payloadError =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : null;
    if (payloadError) {
      logger.warn(
        {
          source: 'planespotters',
          identifier,
          registration,
          error: payloadError,
          url: url.toString(),
        },
        'Planespotters returned an error',
      );
      planespottersCache.set(cacheKey, null);
      return null;
    }
    logger.info(
      {
        source: 'planespotters',
        identifier,
        registration,
        status: response.status,
        url: url.toString(),
        payload,
      },
      'Planespotters response received',
    );

    const photo = resolvePlanespottersPhoto(payload, registration);
    logger.info(
      {
        source: 'planespotters',
        identifier,
        registration,
        photo,
      },
      'Planespotters photo resolved',
    );

    planespottersCache.set(cacheKey, photo ?? null);
    return photo ?? null;
  } catch (error) {
    logger.warn(
      {
        source: 'planespotters',
        identifier,
        registration,
        err: error,
      },
      'Failed to fetch Planespotters photo',
    );
    planespottersCache.set(cacheKey, null);
    return null;
  }
};

/**
 * Resolve a Planespotters photo for the given aircraft identifiers.
 * @param {{hex:string|null, registration:string|null}} params
 * @returns {Promise<{imageUrl:string,pageUrl:string}|null>}
 */
const fetchPlanespottersPhoto = async ({ hex, registration }) => {
  const apiKey = config?.planespotters?.apiKey || '';
  if (!apiKey) {
    logger.info(
      {
        source: 'planespotters',
        reason: 'missingApiKey',
      },
      'Skipping Planespotters lookup (API key not configured)',
    );
    return null;
  }

  if (!hex) {
    return null;
  }

  return fetchPlanespottersByHex({
    identifier: hex,
    registration,
    apiKey,
  });
};

/**
 * Store a resolved photo result under each relevant cache key.
 * @param {string[]} keys
 * @param {{imageUrl:string,pageUrl:string,source:string}|null} value
 */
const cacheResult = (keys, value) => {
  keys.forEach((key) => {
    photoResultCache.set(key, value ?? null);
  });
};

/**
 * Resolve the best available photo (image + page link) for an aircraft.
 * @param {{hex?:string|null,registration?:string|null}} [params]
 * @returns {Promise<{imageUrl:string,pageUrl:string,source:string}|null>}
 */
export const fetchPlanePhoto = async ({ hex, registration } = {}) => {
  const normalizedRegistration = normalizeRegistration(registration);
  const normalizedHex = normalizeHex(hex);

  const cacheKeys = [];
  if (normalizedRegistration) {
    cacheKeys.push(`reg:${normalizedRegistration}`);
  }
  if (normalizedHex) {
    cacheKeys.push(`hex:${normalizedHex}`);
  }

  for (const key of cacheKeys) {
    if (photoResultCache.has(key)) {
      return photoResultCache.get(key);
    }
  }

  let result = null;

  if (normalizedRegistration) {
    logger.info(
      {
        action: 'fetchFlightAwarePhoto',
        registration: normalizedRegistration,
      },
      'Attempting FlightAware lookup',
    );
    const imageUrl = await fetchFlightAwarePhoto(normalizedRegistration);
    if (imageUrl) {
      result = {
        imageUrl,
        pageUrl: buildPlanePhotoPageUrl(normalizedRegistration),
        source: 'flightaware',
      };
    }
  }

  if (!result) {
    logger.info(
      {
        action: 'fetchPlanespottersPhoto',
        hex: normalizedHex,
        registration: normalizedRegistration,
      },
      'Attempting Planespotters lookup',
    );
    const planespottersPhoto = await fetchPlanespottersPhoto({
      hex: normalizedHex,
      registration: normalizedRegistration,
    });
    if (planespottersPhoto?.imageUrl && planespottersPhoto?.pageUrl) {
      result = {
        imageUrl: planespottersPhoto.imageUrl,
        pageUrl: planespottersPhoto.pageUrl,
        source: 'planespotters',
      };
    }
  }

  if (cacheKeys.length) {
    cacheResult(cacheKeys, result);
  }

  logger.info(
    {
      action: 'fetchPlanePhoto',
      hex: normalizedHex,
      registration: normalizedRegistration,
      result: result ?? null,
    },
    'Resolved plane photo',
  );

  return result;
};

/**
 * Convenience helper to fetch only the photo URL for legacy consumers.
 * @param {string|undefined|null} registration
 * @returns {Promise<string|null>}
 */
export const fetchPlanePhotoUrl = async (registration) => {
  const photo = await fetchPlanePhoto({ registration });
  return photo?.imageUrl ?? null;
};

export default {
  fetchPlanePhoto,
  fetchPlanePhotoUrl,
  buildPlanePhotoPageUrl,
};
