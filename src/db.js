import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';
import { normalizeHex } from './utils.js';

const defaultData = {};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeTimestamps = (timestamps) =>
  Array.isArray(timestamps)
    ? timestamps.filter(
        (timestamp) =>
          typeof timestamp === 'number' && Number.isFinite(timestamp),
      )
    : [];

const normalizeRecord = (value) => {
  const record = isPlainObject(value) ? value : {};
  return {
    timestamps: normalizeTimestamps(record.timestamps),
    enrichment:
      record.enrichment && typeof record.enrichment === 'object'
        ? record.enrichment
        : null,
  };
};
const normalizeData = (data = {}) => {
  const normalized = {};

  for (const [key, value] of Object.entries(data)) {
    const hex = normalizeHex(key);
    if (!hex) {
      continue;
    }
    normalized[hex] = normalizeRecord(value);
  }

  return normalized;
};

const ensureStorage = async (dataFilePath) => {
  const dir = dirname(dataFilePath);
  await fs.mkdir(dir, { recursive: true });
};

/**
 * Create a tiny persistence layer around lowdb so the rest of the app does not
 * need to know the JSON file structure.
 */
export const createDb = async ({ dataFile }) => {
  const dataFilePath = resolve(process.cwd(), dataFile);
  await ensureStorage(dataFilePath);

  const adapter = new JSONFile(dataFilePath);
  const low = new Low(adapter, defaultData);
  await low.read();
  low.data = normalizeData(low.data ?? defaultData);

  const findRecord = (hex) => {
    const normalizedHex = normalizeHex(hex);
    if (!normalizedHex) {
      return null;
    }
    return low.data[normalizedHex] ?? null;
  };

  const ensureRecord = (hex) => {
    const normalizedHex = normalizeHex(hex);
    if (!normalizedHex) {
      return null;
    }

    let record = findRecord(normalizedHex);
    if (!record) {
      record = normalizeRecord(null);
      low.data[normalizedHex] = record;
    }

    if (!Array.isArray(record.timestamps)) {
      record.timestamps = [];
    }

    return record;
  };

  return {
    // Writes are batched by the poller. Most helpers only mutate memory and the
    // caller decides when to flush to disk.
    async save() {
      await low.write();
    },
    getSightingTimestamps(hex) {
      const record = findRecord(hex);
      return Array.isArray(record?.timestamps) ? record.timestamps : [];
    },
    recordSighting(hex, timestamp) {
      const record = ensureRecord(hex);
      if (!record) {
        return;
      }
      record.timestamps.push(timestamp);
    },
    getTrackingCount() {
      return Object.values(low.data).filter(
        (entry) => Array.isArray(entry?.timestamps) && entry.timestamps.length,
      ).length;
    },
    getEnrichment(hex) {
      return findRecord(hex)?.enrichment ?? null;
    },
    setEnrichment(hex, entry) {
      const record = ensureRecord(hex);
      if (!record) {
        return;
      }
      record.enrichment = entry && typeof entry === 'object' ? entry : null;
    },
  };
};

export default createDb;
