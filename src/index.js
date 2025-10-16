import cron from 'node-cron';

import config from './config.js';
import db from './db.js';
import logger from './logger.js';
import { publishBlueskyPost } from './bluesky.js';
import { composeNotificationMessage } from './messages.js';
import { fetchPlanePhotoUrl } from './photos.js';
import { shouldIgnoreCarrier } from './filters.js';
import {
  resolveAltitudeFt,
  isGrounded,
  isAboveConfiguredCeiling,
} from './utils.js';

const endpointBase = 'https://api.airplanes.live/v2';
const cronExpression = `*/${config.pollIntervalSeconds} * * * * *`;
let isPolling = false;

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
      const hex = plane.hex?.toLowerCase();
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
          const { body } = composeNotificationMessage(
            plane,
            messageTimestamps,
            now,
          );
          let attachments = undefined;
          const registration = plane.registration ?? plane.r;
          if (registration) {
            const photoUrl = await fetchPlanePhotoUrl(registration);
            if (photoUrl) {
              attachments = [photoUrl];
            }
          }
          await publishBlueskyPost({ text: body, attachments });
          logger.info(
            {
              ...plane,
              attachments,
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
