import cron from 'node-cron';

import config from './config.js';
import db from './db.js';
import logger from './logger.js';
import { publishBlueskyPost } from './bluesky.js';
import { composeNotificationMessage } from './messages.js';
import { fetchPlanePhoto } from './photos.js';
import { shouldIgnoreCarrier } from './filters.js';
import {
  notifyHealthcheckSuccess,
  notifyHealthcheckFailure,
} from './healthchecks.js';
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

const SOURCE_LABELS = {
  flightaware: 'FlightAware',
  planespotters: 'Planespotters.net',
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

/**
 * Build alt text for plane imagery, incorporating available context.
 * @param {{identityTag:string|null,description:string|null,photographer:string|null,source:string|null}} params
 * @returns {string|null}
 */
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
    base = base ? `${base} ${copyright}` : copyright;
  } else {
    const sourceLabel = resolveSourceLabel(source);
    if (sourceLabel) {
      const courtesy = `Photo courtesy of ${sourceLabel}.`;
      base = base ? `${base} ${courtesy}` : courtesy;
    }
  }

  return base;
};

const logFilterRejection = (plane, reason, details = {}) => {
  logger.info(
    {
      reason,
      hex: plane?.hex ?? null,
      flight: plane?.flight ?? null,
      registration: plane?.registration ?? plane?.r ?? null,
      altitude: plane?.alt_baro ?? null,
      ...details,
      plane,
    },
    'Plane rejected by filter',
  );
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
  let encounteredError = false;
  let lastError = null;
  let inspectedCount = 0;
  let notifiedCount = 0;
  let rejectedCount = 0;
  let aircraftCount = 0;

  logger.debug(
    { pollStartedAt: new Date(startedAt).toISOString() },
    'Poll cycle started',
  );

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
      encounteredError = true;
      lastError = `airplanes.live responded with status ${response.status}`;
      return;
    }

    const payload = await response.json();
    const aircraft = Array.isArray(payload.ac) ? payload.ac : [];
    aircraftCount = aircraft.length;

    logger.debug(
      {
        aircraftCount,
      },
      'Poll response received',
    );

    if (!aircraft.length) {
      logger.debug('No aircraft detected during poll');
      return;
    }

    const now = Date.now();

    for (const plane of aircraft) {
      const hex = normalizeHex(plane.hex);
      inspectedCount += 1;
      if (!hex) {
        rejectedCount += 1;
        logFilterRejection(plane, 'invalidHex');
        continue;
      }

      if (shouldIgnoreCarrier(plane.flight, config.ignoredCarrierCodes)) {
        rejectedCount += 1;
        logFilterRejection(plane, 'ignoredCarrier', {
          ignoredCarrierCodes: config.ignoredCarrierCodes,
        });
        continue;
      }

      if (isGrounded(plane)) {
        rejectedCount += 1;
        logFilterRejection(plane, 'grounded');
        continue;
      }

      const altitudeFt = resolveAltitudeFt(plane);
      if (isAboveConfiguredCeiling(altitudeFt, config.maxAltitudeFt)) {
        rejectedCount += 1;
        logFilterRejection(plane, 'aboveConfiguredCeiling', {
          altitudeFt,
          maxAltitudeFt: config.maxAltitudeFt,
        });
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
          notifiedCount += 1;
        } catch (error) {
          logger.error(
            { err: error, ...plane },
            'Failed to publish Bluesky update',
          );
          encounteredError = true;
          lastError = error;
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
    encounteredError = true;
    lastError = error;
  } finally {
    if (hasChanges) {
      await db.write();
    }

    isPolling = false;
    const elapsed = Date.now() - startedAt;
    const trackingCount = Array.isArray(db.data?.sightings)
      ? db.data.sightings.filter(
          (entry) => Array.isArray(entry.timestamps) && entry.timestamps.length,
        ).length
      : 0;
    logger.debug(
      {
        elapsedMs: elapsed,
        aircraftCount,
        inspectedCount,
        notifiedCount,
        rejectedCount,
        trackingCount,
      },
      'Poll cycle completed',
    );

    const healthcheckPayload = {
      elapsedMs: elapsed,
      hasChanges,
      timestamp: new Date().toISOString(),
    };

    if (encounteredError) {
      const errorMessage =
        lastError instanceof Error
          ? lastError.message
          : typeof lastError === 'string'
            ? lastError
            : 'Unknown error';
      await notifyHealthcheckFailure({
        ...healthcheckPayload,
        error: errorMessage,
      });
    } else {
      await notifyHealthcheckSuccess(healthcheckPayload);
    }
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
