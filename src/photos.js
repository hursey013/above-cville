const FLIGHTAWARE_BASE = 'https://www.flightaware.com/photos/aircraft';
const DEFAULT_IMAGE = 'https://www.flightaware.com/images/og_default_image.png';

const photoCache = new Map();

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
  const trimmed = registration?.toString?.().trim?.().toUpperCase?.();
  if (!trimmed) {
    return null;
  }

  if (photoCache.has(trimmed)) {
    return photoCache.get(trimmed);
  }

  const url = `${FLIGHTAWARE_BASE}/${encodeURIComponent(trimmed)}/sort/date`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      photoCache.set(trimmed, null);
      return null;
    }

    const html = await response.text();
    const imageUrl = extractOgImage(html);
    photoCache.set(trimmed, imageUrl ?? null);
    return imageUrl ?? null;
  } catch (error) {
    console.warn(`Failed to fetch FlightAware photo for ${trimmed}`, error);
    photoCache.set(trimmed, null);
    return null;
  }
};

export default {
  fetchPlanePhotoUrl,
};
