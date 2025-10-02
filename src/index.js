import cron from 'node-cron';

import config from './config.js';
import db from './db.js';
import { sendAppriseNotification } from './notifications.js';
import { distanceNm, nowIso } from './utils.js';

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
        'User-Agent': 'above-cville/2.0.0 (+https://github.com/hursey013/above-cville)'
      }
    });

    if (!response.ok) {
      console.error(`airplanes.live responded with ${response.status}`);
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

      const lastNotification = db.data.cooldowns[hex];
      const secondsSinceLast = lastNotification ? (now - lastNotification) / 1000 : Infinity;
      const distance =
        typeof plane.dist === 'number'
          ? plane.dist
          : distanceNm(config.latitude, config.longitude, plane.lat, plane.lon);

      const sightingRecord = {
        hex,
        flight: plane.flight?.trim() || null,
        registration: plane.r || null,
        type: plane.t || null,
        altitude: plane.alt_baro ?? plane.alt_geom ?? null,
        groundSpeed: plane.gs ?? null,
        latitude: typeof plane.lat === 'number' ? plane.lat : null,
        longitude: typeof plane.lon === 'number' ? plane.lon : null,
        distanceNm: typeof distance === 'number' ? distance : null,
        detectedAt: nowIso(),
        notified: false
      };

      let shouldNotify = secondsSinceLast >= config.cooldownMinutes * 60;

      if (!lastNotification) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        await sendAppriseNotification(plane, sightingRecord.distanceNm ?? undefined);
        db.data.cooldowns[hex] = now;
        sightingRecord.notified = true;
        console.log(
          `[notify] ${plane.flight?.trim() || hex.toUpperCase()} | distance: ${
            sightingRecord.distanceNm?.toFixed(2) ?? 'unknown'
          } NM`
        );
      }

      db.data.sightings.push(sightingRecord);
      hasChanges = true;
    }

    if (config.historyLimit > 0 && db.data.sightings.length > config.historyLimit) {
      const removeCount = db.data.sightings.length - config.historyLimit;
      db.data.sightings.splice(0, removeCount);
      hasChanges = true;
    }
  } catch (error) {
    console.error('Failed to poll airplanes.live', error);
  } finally {
    if (hasChanges) {
      await db.write();
    }

    isPolling = false;
    const elapsed = Date.now() - startedAt;
    console.debug(`Poll completed in ${elapsed} ms`);
  }
};

console.log('Starting airplanes.live poller');
console.log(
  `Watching ${config.latitude}, ${config.longitude} within ${config.radius} NM (cooldown: ${config.cooldownMinutes} minutes)`
);

cron.schedule(cronExpression, () => {
  pollAirplanes().catch((error) => {
    console.error('Unhandled polling error', error);
  });
});

await pollAirplanes();
