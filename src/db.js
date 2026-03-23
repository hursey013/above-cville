import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';
import { normalizeHex } from './utils.js';

const defaultData = {};

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
  low.data = low.data ?? defaultData;

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
      record = {
        timestamps: [],
        enrichment: null,
      };
      low.data[normalizedHex] = record;
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
      return record?.timestamps ?? [];
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
      record.enrichment = entry;
    },
  };
};

export default createDb;
