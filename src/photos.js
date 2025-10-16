const FLIGHTAWARE_BASE = 'https://www.flightaware.com/photos/aircraft';
const DEFAULT_IMAGE = 'https://www.flightaware.com/images/og_default_image.png';

const photoCache = new Map();

const normalizeRegistration = (registration) =>
  registration?.toString?.().trim?.().toUpperCase?.() ?? '';

export const buildPlanePhotoPageUrl = (registration) => {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return null;
  }
  return `${FLIGHTAWARE_BASE}/${encodeURIComponent(normalized)}`;
};

/**
 * Extract the OG image URL from a FlightAware photo gallery HTML document.
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
 * Resolve a FlightAware photo URL for a given registration, caching the result.
 * @param {string|undefined|null} registration
 * @returns {Promise<string|null>}
 */
export const fetchPlanePhotoUrl = async (registration) => {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return null;
  }

  if (photoCache.has(normalized)) {
    return photoCache.get(normalized);
  }

  const url = `${FLIGHTAWARE_BASE}/${encodeURIComponent(normalized)}/sort/date`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      photoCache.set(normalized, null);
      return null;
    }

    const html = await response.text();
    const imageUrl = extractOgImage(html);
    photoCache.set(normalized, imageUrl ?? null);
    return imageUrl ?? null;
  } catch (error) {
    console.warn(`Failed to fetch FlightAware photo for ${normalized}`, error);
    photoCache.set(normalized, null);
    return null;
  }
};

export default {
  fetchPlanePhotoUrl,
  buildPlanePhotoPageUrl,
};
