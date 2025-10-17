import cron from 'node-cron';

import config from './config.js';
import db from './db.js';
import logger from './logger.js';
import { publishBlueskyPost } from './bluesky.js';
import { composeNotificationMessage } from './messages.js';
import { fetchPlanePhoto } from './photos.js';
import { shouldIgnoreCarrier } from './filters.js';
import {
  resolveAltitudeFt,
  isGrounded,
  isAboveConfiguredCeiling,
  normalizeHex,
  normalizeRegistration,
  formatAircraftDescription,
  buildIdentityHashtag,
} from './utils.js';

const endpointBase = 'https://api.airplanes.live/v2';
const cronExpression = `*/${config.pollIntervalSeconds} * * * * *`;
let isPolling = false;

/**
 * Choose the best identifier to convert into a hashtag for the aircraft.
 * Prefers the registration, then flight number, then ICAO hex.
 * @param {Record<string, any>} plane
 * @param {string|null} registration
 * @returns {string|null}
 */
const resolvePlaneIdentityTag = (plane, registration) => {
  const registrationTag = registration
    ? buildIdentityHashtag(registration)
    : null;
  if (registrationTag) {
    return registrationTag;
  }

  const flight = typeof plane.flight === 'string' ? plane.flight.trim() : '';
  if (flight) {
    const flightTag = buildIdentityHashtag(flight);
    if (flightTag) {
      return flightTag;
    }
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

/**
 * Build alt text for plane imagery, incorporating available context.
 * @param {{identityTag:string|null,description:string|null}} params
 * @returns {string|null}
 */
const buildPhotoAltText = ({ identityTag, description }) => {
  if (identityTag && description) {
    return `Recent photo of ${identityTag} — ${description}.`;
  }
  if (identityTag) {
    return `Recent photo of ${identityTag}.`;
  }
  if (description) {
    return `Recent aircraft photo: ${description}.`;
  }
  return null;
};

/**
 * Poll airplanes.live for the configured lat/lon window, write any new
 * sightings, and post Bluesky updates when the cooldown allows.
 */
const pollAirplanes = async () => {
  if (isPolling) {
    return;
  }

  isPolling = true;
  let hasChanges = false;
  const startedAt = Date.now();

  try {
    const url = `${endpointBase}/point/${config.latitude}/${config.longitude}/${config.radius}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'above-cville/2.0.0 (+https://github.com/hursey013/above-cville)',
      },
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, url },
        'airplanes.live responded with non-success status',
      );
      return;
    }

    const payload = await response.json();
    const aircraft = Array.isArray(payload.ac) ? payload.ac : [];

    if (!aircraft.length) {
      return;
    }

    const now = Date.now();

    for (const plane of aircraft) {
      const hex = normalizeHex(plane.hex);
      if (!hex) {
        continue;
      }

      if (shouldIgnoreCarrier(plane.flight, config.ignoredCarrierCodes)) {
        continue;
      }

      if (isGrounded(plane)) {
        continue;
      }

      const altitudeFt = resolveAltitudeFt(plane);
      if (isAboveConfiguredCeiling(altitudeFt, config.maxAltitudeFt)) {
        continue;
      }

      let sightingEntry = db.data.sightings.find((entry) => entry.hex === hex);
      const timestamps = Array.isArray(sightingEntry?.timestamps)
        ? sightingEntry.timestamps
        : [];
      const lastTimestampMs = timestamps.length
        ? timestamps[timestamps.length - 1]
        : null;
      const secondsSinceLast =
        lastTimestampMs !== null ? (now - lastTimestampMs) / 1000 : Infinity;
      let shouldNotify = secondsSinceLast >= config.cooldownMinutes * 60;

      if (lastTimestampMs === null) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        const messageTimestamps = [...timestamps, now];
        try {
          let attachments = undefined;
          let photoPageUrl = null;
          const planeDescription = formatAircraftDescription(plane.desc);
          const registration =
            normalizeRegistration(plane.registration ?? plane.r) || null;
          const photo = await fetchPlanePhoto({
            hex,
            registration,
          });
          if (photo?.imageUrl) {
            const identityTag = resolvePlaneIdentityTag(plane, registration);
            const altText = buildPhotoAltText({
              identityTag,
              description: planeDescription,
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
          const { body } = composeNotificationMessage(
            plane,
            messageTimestamps,
            now,
            { photoPageUrl },
          );
          await publishBlueskyPost({ text: body, attachments });
          logger.info(
            {
              ...plane,
              attachments,
              photoSource: photo?.source ?? null,
            },
            'Bluesky update published',
          );
        } catch (error) {
          logger.error(
            { err: error, ...plane },
            'Failed to publish Bluesky update',
          );
        }
        if (!sightingEntry) {
          sightingEntry = { hex, timestamps: [] };
          db.data.sightings.push(sightingEntry);
        }
        if (!Array.isArray(sightingEntry.timestamps)) {
          sightingEntry.timestamps = [];
        }
        sightingEntry.timestamps.push(now);
        hasChanges = true;
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to poll airplanes.live');
  } finally {
    if (hasChanges) {
      await db.write();
    }

    isPolling = false;
    const elapsed = Date.now() - startedAt;
    logger.debug({ elapsedMs: elapsed }, 'Poll cycle completed');
  }
};

logger.info('Starting airplanes.live poller');
logger.info(
  {
    latitude: config.latitude,
    longitude: config.longitude,
    radiusNm: config.radius,
    cooldownMinutes: config.cooldownMinutes,
    pollIntervalSeconds: config.pollIntervalSeconds,
  },
  'Watching location',
);

cron.schedule(cronExpression, () => {
  pollAirplanes().catch((error) => {
    logger.error({ err: error }, 'Unhandled polling error');
  });
});

await pollAirplanes();
