import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';

import config from './config.js';

const dataFilePath = resolve(process.cwd(), config.dataFile);

const ensureStorage = async () => {
  const dir = dirname(dataFilePath);
  await fs.mkdir(dir, { recursive: true });
};

await ensureStorage();

const adapter = new JSONFile(dataFilePath);
const defaultData = {
  sightings: []
};

const normalizeSightings = (rawSightings) => {
  const sightingsByHex = new Map();

  const addTimestamp = (hex, candidate) => {
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      return;
    }

    if (!sightingsByHex.has(hex)) {
      sightingsByHex.set(hex, new Set());
    }

    sightingsByHex.get(hex).add(candidate);
  };

  if (Array.isArray(rawSightings)) {
    for (const record of rawSightings) {
      if (!record || typeof record !== 'object') {
        continue;
      }

      const hex = typeof record.hex === 'string' ? record.hex.toLowerCase() : null;
      if (!hex) {
        continue;
      }

      const { timestamps } = record;
      if (!Array.isArray(timestamps)) {
        continue;
      }

      for (const value of timestamps) {
        addTimestamp(hex, value);
      }
    }
  }

  const normalized = Array.from(sightingsByHex.entries())
    .map(([hex, timestampSet]) => ({
      hex,
      timestamps: Array.from(timestampSet).sort((a, b) => a - b)
    }))
    .sort((a, b) => {
      const aFirst = a.timestamps[0] ?? Number.POSITIVE_INFINITY;
      const bFirst = b.timestamps[0] ?? Number.POSITIVE_INFINITY;
      return aFirst - bFirst;
    });

  return normalized;
};

const db = new Low(adapter, defaultData);
await db.read();

if (!db.data) {
  db.data = defaultData;
}

let shouldWrite = false;

if ('cooldowns' in db.data) {
  delete db.data.cooldowns;
  shouldWrite = true;
}

const normalizedSightings = normalizeSightings(db.data.sightings);
const originalSightingsJson = JSON.stringify(db.data.sightings ?? []);
const normalizedSightingsJson = JSON.stringify(normalizedSightings);

if (originalSightingsJson !== normalizedSightingsJson) {
  db.data.sightings = normalizedSightings;
  shouldWrite = true;
}

if (shouldWrite) {
  await db.write();
}

export default db;
