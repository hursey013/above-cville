import cron from 'node-cron';

import config from './config.js';
import db from './db.js';
import { sendAppriseNotification } from './notifications.js';

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

      const altitudeRaw = plane.alt_baro;
      if (typeof altitudeRaw === 'string') {
        if (altitudeRaw.trim().toLowerCase() === 'ground') {
          continue;
        }
      }

      let altitudeNumeric = null;
      if (typeof altitudeRaw === 'number' && Number.isFinite(altitudeRaw)) {
        altitudeNumeric = altitudeRaw;
      } else if (typeof altitudeRaw === 'string') {
        const parsed = Number(altitudeRaw);
        if (Number.isFinite(parsed)) {
          altitudeNumeric = parsed;
        }
      }

      const maxAltitude =
        Number.isFinite(config.maxAltitudeFt) && config.maxAltitudeFt > 0
          ? config.maxAltitudeFt
          : null;
      if (maxAltitude !== null && altitudeNumeric !== null && altitudeNumeric > maxAltitude) {
        continue;
      }

      let sightingEntry = db.data.sightings.find((entry) => entry.hex === hex);
      const timestamps = Array.isArray(sightingEntry?.timestamps) ? sightingEntry.timestamps : [];
      const lastTimestampMs = timestamps.length
        ? timestamps[timestamps.length - 1]
        : null;
      const secondsSinceLast = lastTimestampMs !== null ? (now - lastTimestampMs) / 1000 : Infinity;
      let shouldNotify = secondsSinceLast >= config.cooldownMinutes * 60;

      if (lastTimestampMs === null) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        await sendAppriseNotification(plane);
        if (!sightingEntry) {
          sightingEntry = { hex, timestamps: [] };
          db.data.sightings.push(sightingEntry);
        }
        if (!Array.isArray(sightingEntry.timestamps)) {
          sightingEntry.timestamps = [];
        }
        sightingEntry.timestamps.push(now);
        console.log(
          `[notify] ${plane.flight?.trim() || hex.toUpperCase()}`
        );
        hasChanges = true;
      }
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
