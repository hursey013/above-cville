import { composeNotificationMessage } from './messages.js';
import { fetchPlanePhoto } from './photos.js';
import {
  buildIdentityHashtag,
  formatAircraftDescription,
  normalizeRegistration,
} from './utils.js';

const SOURCE_LABELS = {
  flightaware: 'FlightAware',
  planespotters: 'Planespotters.net',
};

// Hashtags and alt text read best when they use the identifier most people will
// recognize in the post itself, so prefer callsign, then registration, then
// ICAO hex as a last resort.
const resolvePlaneIdentityTag = (plane, registration) => {
  const flight = typeof plane.flight === 'string' ? plane.flight.trim() : '';
  if (flight) {
    const flightTag = buildIdentityHashtag(flight);
    if (flightTag) {
      return flightTag;
    }
  }

  const registrationTag = registration
    ? buildIdentityHashtag(registration)
    : null;
  if (registrationTag) {
    return registrationTag;
  }

  const hex =
    typeof plane.hex === 'string' ? plane.hex.trim().toUpperCase() : '';
  if (hex) {
    const hexTag = buildIdentityHashtag(hex);
    if (hexTag) {
      return hexTag;
    }
  }

  return null;
};

const resolveSourceLabel = (source) => {
  if (typeof source !== 'string') {
    return null;
  }

  const normalized = source.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (SOURCE_LABELS[normalized]) {
    return SOURCE_LABELS[normalized];
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

// Alt text is assembled here instead of in the photo provider modules so all
// post-specific presentation logic stays in one place.
const buildPhotoAltText = ({
  identityTag,
  description,
  photographer,
  source,
}) => {
  let base = null;
  if (identityTag && description) {
    base = `Recent photo of ${identityTag} — ${description}.`;
  } else if (identityTag) {
    base = `Recent photo of ${identityTag}.`;
  } else if (description) {
    base = `Recent aircraft photo: ${description}.`;
  }

  const trimmedPhotographer =
    typeof photographer === 'string' && photographer.trim()
      ? photographer.trim()
      : null;

  if (trimmedPhotographer) {
    const copyright = trimmedPhotographer.startsWith('©')
      ? trimmedPhotographer
      : `© ${trimmedPhotographer}`;
    return base ? `${base} ${copyright}` : copyright;
  }

  const sourceLabel = resolveSourceLabel(source);
  if (!sourceLabel) {
    return base;
  }

  const courtesy = `Photo courtesy of ${sourceLabel}.`;
  return base ? `${base} ${courtesy}` : courtesy;
};

/**
 * Build the final post payload for one plane.
 * This wraps photo lookup so the poller only has to deal with "should we post?"
 * and not "how should the post look?".
 */
export const prepareNotification = async ({
  plane,
  timestamps,
  now,
  aircraftLinkBase,
  showDetailsLink,
}) => {
  let attachments = undefined;
  let photoPageUrl = null;

  const registration =
    normalizeRegistration(plane.registration ?? plane.r) || null;
  const planeDescription = formatAircraftDescription(plane.desc);
  const photo = await fetchPlanePhoto({
    hex: plane.hex,
    registration,
  });

  if (photo?.imageUrl) {
    const identityTag = resolvePlaneIdentityTag(plane, registration);
    const altText = buildPhotoAltText({
      identityTag,
      description: planeDescription,
      photographer: photo?.photographer ?? null,
      source: photo?.source ?? null,
    });
    photoPageUrl = photo.pageUrl ?? null;
    attachments = [
      altText
        ? {
            url: photo.imageUrl,
            altText,
          }
        : photo.imageUrl,
    ];
  }

  const { body } = composeNotificationMessage(plane, timestamps, now, {
    aircraftLinkBase,
    showDetailsLink,
    photoPageUrl,
  });

  return {
    text: body,
    attachments,
    photoSource: photo?.source ?? null,
  };
};

export default {
  prepareNotification,
};
