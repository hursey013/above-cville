import config from './config.js';
import { normalizeHex, normalizeRegistration } from './utils.js';

const FLIGHTAWARE_BASE = 'https://www.flightaware.com/photos/aircraft';
const DEFAULT_IMAGE = 'https://www.flightaware.com/images/og_default_image.png';
const PLANESPOTTERS_PUBLIC_BASE = 'https://api.planespotters.net/pub/photos';
const PLANESPOTTERS_API_BASE = 'https://api.planespotters.net/v1/photos';

const flightAwareCache = new Map();
const planespottersCache = new Map();
const photoResultCache = new Map();

export const buildPlanePhotoPageUrl = (registration) => {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return null;
  }
  return `${FLIGHTAWARE_BASE}/${encodeURIComponent(normalized)}`;
};

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

const fetchFlightAwarePhoto = async (registration) => {
  if (!registration) {
    return null;
  }

  if (flightAwareCache.has(registration)) {
    return flightAwareCache.get(registration);
  }

  const pageUrl = `${FLIGHTAWARE_BASE}/${encodeURIComponent(registration)}/sort/date`;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      flightAwareCache.set(registration, null);
      return null;
    }

    const html = await response.text();
    const imageUrl = extractOgImage(html);
    flightAwareCache.set(registration, imageUrl ?? null);
    return imageUrl ?? null;
  } catch (error) {
    console.warn(`Failed to fetch FlightAware photo for ${registration}`, error);
    flightAwareCache.set(registration, null);
    return null;
  }
};

const resolvePlanespottersPhoto = (payload) => {
  const photos = Array.isArray(payload?.photos) ? payload.photos : [];
  for (const photo of photos) {
    if (!photo || typeof photo !== 'object') {
      continue;
    }
    const imageCandidate =
      typeof photo.thumbnail_large === 'string' && photo.thumbnail_large.trim()
        ? photo.thumbnail_large.trim()
        : typeof photo.thumbnail === 'string' && photo.thumbnail.trim()
          ? photo.thumbnail.trim()
          : null;
    const linkCandidate =
      typeof photo.link === 'string' && photo.link.trim()
        ? photo.link.trim()
        : typeof photo.photo_link === 'string' && photo.photo_link.trim()
          ? photo.photo_link.trim()
          : null;
    if (imageCandidate && linkCandidate) {
      return {
        imageUrl: imageCandidate,
        pageUrl: linkCandidate,
      };
    }
  }
  return null;
};

const fetchPlanespottersBy = async (type, value, apiKey) => {
  if (!value) {
    return null;
  }

  const cacheKey = `${type}:${value}`;
  if (planespottersCache.has(cacheKey)) {
    return planespottersCache.get(cacheKey);
  }

  try {
    const hasApiKey = Boolean(apiKey);
    const base = hasApiKey ? PLANESPOTTERS_API_BASE : PLANESPOTTERS_PUBLIC_BASE;
    const url = new URL(
      `${base}/${type}/${encodeURIComponent(value)}`,
    );
    if (hasApiKey) {
      url.searchParams.set('api_key', apiKey);
    }
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      planespottersCache.set(cacheKey, null);
      return null;
    }
    const payload = await response.json();
    const photo = resolvePlanespottersPhoto(payload);
    planespottersCache.set(cacheKey, photo ?? null);
    return photo ?? null;
  } catch (error) {
    console.warn(
      `Failed to fetch Planespotters photo for ${type} ${value}`,
      error,
    );
    planespottersCache.set(cacheKey, null);
    return null;
  }
};

const fetchPlanespottersPhoto = async ({ hex, registration }) => {
  const apiKey = config?.planespotters?.apiKey || '';
  let photo = null;

  if (hex) {
    photo = await fetchPlanespottersBy('hex', hex, apiKey || undefined);
  }

  if (!photo && apiKey && registration) {
    photo = await fetchPlanespottersBy('registration', registration, apiKey);
  }

  return photo;
};

const cacheResult = (keys, value) => {
  keys.forEach((key) => {
    photoResultCache.set(key, value ?? null);
  });
};

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

  return result;
};

export const fetchPlanePhotoUrl = async (registration) => {
  const photo = await fetchPlanePhoto({ registration });
  return photo?.imageUrl ?? null;
};

export default {
  fetchPlanePhoto,
  fetchPlanePhotoUrl,
  buildPlanePhotoPageUrl,
};
