import {
  LOCAL_READSB_SOURCE,
  fetchAircraftSnapshot,
} from './aircraftSource.js';
import { enrichPlane } from './aircraftEnrichment.js';
import { prepareNotification } from './notifications.js';
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
} from './utils.js';

// Local readsb feeds usually have most of what we need already. Limiting
// enrichment to one request per poll keeps the fallback cheap and predictable.
const MAX_ENRICHMENT_REQUESTS_PER_POLL = 1;

/**
 * Centralized rejection logging keeps the "why was this plane skipped?"
 * story readable in logs without repeating the same fields everywhere.
 */
const logFilterRejection = (logger, plane, reason, details = {}) => {
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
 * Turn a plane's sighting history into a single "should we post now?" answer.
 * The poller only cares about the latest timestamp and the cooldown window.
 */
const resolveNotificationState = (timestamps, now, cooldownMinutes) => {
  const lastTimestampMs = timestamps.length
    ? timestamps[timestamps.length - 1]
    : null;
  const secondsSinceLast =
    lastTimestampMs !== null ? (now - lastTimestampMs) / 1000 : Infinity;
  const shouldNotify =
    lastTimestampMs === null || secondsSinceLast >= cooldownMinutes * 60;

  return {
    secondsSinceLast,
    shouldNotify,
  };
};

/**
 * Create a single-run poller that can be scheduled by index.js.
 * The poller owns the runtime pipeline:
 * 1. fetch aircraft
 * 2. optionally enrich local-feed records
 * 3. apply filters/cooldown
 * 4. prepare and publish a notification
 * 5. persist any new timestamps/cache entries
 */
export const createPoller = ({ config, db, publisher, logger }) => {
  let isPolling = false;
  const enrichmentSuccessTtlMs =
    config.aircraftApi.enrichmentTtlMinutes * 60 * 1000;

  const runPoll = async () => {
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
    let enrichmentRequests = 0;

    logger.debug(
      { pollStartedAt: new Date(startedAt).toISOString() },
      'Poll cycle started',
    );

    try {
      const snapshot = await fetchAircraftSnapshot({
        source: config.aircraftApi.source,
        baseUrl: config.aircraftApi.baseUrl,
        latitude: config.latitude,
        longitude: config.longitude,
        radius: config.radius,
      });
      const aircraft = snapshot.aircraft;
      aircraftCount = aircraft.length;

      logger.debug(
        {
          aircraftCount,
          source: snapshot.source,
        },
        'Poll response received',
      );

      const now = Date.now();
      if (!aircraft.length) {
        logger.debug('No aircraft detected during poll');
        return;
      }

      let remainingEnrichmentRequests = MAX_ENRICHMENT_REQUESTS_PER_POLL;

      for (const plane of aircraft) {
        const hex = normalizeHex(plane.hex);
        inspectedCount += 1;
        if (!hex) {
          rejectedCount += 1;
          logFilterRejection(logger, plane, 'invalidHex');
          continue;
        }

        let planeRecord = plane;
        if (snapshot.source === LOCAL_READSB_SOURCE) {
          // Only local feeds need enrichment. airplanes.live already carries
          // the extra identity metadata that this project uses for posts.
          const cachedEnrichment = db.getEnrichment(hex);
          const enrichmentResult = await enrichPlane({
            plane,
            now,
            cacheEntry: cachedEnrichment,
            successTtlMs: enrichmentSuccessTtlMs,
            allowRequest: remainingEnrichmentRequests > 0,
          });
          planeRecord = enrichmentResult.plane;

          if (enrichmentResult.requestUsed) {
            enrichmentRequests += 1;
            remainingEnrichmentRequests -= 1;
          }

          if (
            enrichmentResult.requestUsed &&
            enrichmentResult.cacheEntry !== cachedEnrichment
          ) {
            db.setEnrichment(hex, enrichmentResult.cacheEntry);
            hasChanges = true;
          }
        }

        if (
          shouldIgnoreCarrier(planeRecord.flight, config.ignoredCarrierCodes)
        ) {
          rejectedCount += 1;
          logFilterRejection(logger, planeRecord, 'ignoredCarrier', {
            ignoredCarrierCodes: config.ignoredCarrierCodes,
          });
          continue;
        }

        if (isGrounded(planeRecord)) {
          rejectedCount += 1;
          logFilterRejection(logger, planeRecord, 'grounded');
          continue;
        }

        const altitudeFt = resolveAltitudeFt(planeRecord);
        if (isAboveConfiguredCeiling(altitudeFt, config.maxAltitudeFt)) {
          rejectedCount += 1;
          logFilterRejection(logger, planeRecord, 'aboveConfiguredCeiling', {
            altitudeFt,
            maxAltitudeFt: config.maxAltitudeFt,
          });
          continue;
        }

        const timestamps = db.getSightingTimestamps(hex);
        const { secondsSinceLast, shouldNotify } = resolveNotificationState(
          timestamps,
          now,
          config.cooldownMinutes,
        );

        if (!shouldNotify) {
          rejectedCount += 1;
          const cooldownSeconds = config.cooldownMinutes * 60;
          logFilterRejection(logger, planeRecord, 'cooldownActive', {
            cooldownSeconds,
            secondsSinceLast: Number.isFinite(secondsSinceLast)
              ? Math.round(secondsSinceLast)
              : null,
            secondsUntilNext: Number.isFinite(secondsSinceLast)
              ? Math.max(0, Math.round(cooldownSeconds - secondsSinceLast))
              : null,
          });
          continue;
        }

        const messageTimestamps = [...timestamps, now];
        try {
          // Notification assembly handles photos, alt text, and final post text
          // so the poller can stay focused on control flow.
          const notification = await prepareNotification({
            plane: planeRecord,
            timestamps: messageTimestamps,
            now,
            aircraftLinkBase: config.aircraftLinkBase,
            showDetailsLink: config.showDetailsLink,
          });
          await publisher.publish({
            text: notification.text,
            attachments: notification.attachments,
          });
          logger.info(
            {
              ...planeRecord,
              attachments: notification.attachments,
              photoSource: notification.photoSource,
            },
            publisher.isDryRun
              ? 'Bluesky update prepared (dry run)'
              : 'Bluesky update published',
          );
          notifiedCount += 1;
        } catch (error) {
          logger.error(
            { err: error, ...planeRecord },
            'Failed to publish Bluesky update',
          );
          encounteredError = true;
          lastError = error;
        }

        // Persist the timestamp even in dry-run mode. The bot should behave
        // like a normal poll cycle except for the final external side effect.
        db.recordSighting(hex, now);
        hasChanges = true;
      }
    } catch (error) {
      logger.error(
        {
          err: error,
          source: config.aircraftApi.source,
          baseUrl: config.aircraftApi.baseUrl,
        },
        'Failed to poll aircraft API',
      );
      encounteredError = true;
      lastError = error;
    } finally {
      if (hasChanges) {
        await db.save();
      }

      isPolling = false;
      const elapsed = Date.now() - startedAt;
      logger.debug(
        {
          elapsedMs: elapsed,
          aircraftCount,
          inspectedCount,
          notifiedCount,
          rejectedCount,
          trackingCount: db.getTrackingCount(),
          enrichmentRequests,
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

  return {
    runPoll,
  };
};

export default {
  createPoller,
};
