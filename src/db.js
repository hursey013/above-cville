import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';

const defaultData = {
  sightings: [],
  enrichmentCache: {},
};

// Keep the on-disk format forgiving. Older installs may still have enrichment
// data nested under apiDiagnostics from an earlier iteration of the feature.
const normalizeData = (data = {}) => {
  const normalized = {
    sightings: Array.isArray(data.sightings) ? data.sightings : [],
    enrichmentCache:
      data.enrichmentCache && typeof data.enrichmentCache === 'object'
        ? data.enrichmentCache
        : {},
  };

  if (!Object.keys(normalized.enrichmentCache).length) {
    const legacyCache = data.apiDiagnostics?.enrichmentCache;
    if (legacyCache && typeof legacyCache === 'object') {
      normalized.enrichmentCache = legacyCache;
    }
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

  const findSighting = (hex) =>
    low.data.sightings.find((entry) => entry?.hex === hex) ?? null;

  const ensureSighting = (hex) => {
    let sighting = findSighting(hex);
    if (!sighting) {
      sighting = { hex, timestamps: [] };
      low.data.sightings.push(sighting);
    }

    if (!Array.isArray(sighting.timestamps)) {
      sighting.timestamps = [];
    }

    return sighting;
  };

  return {
    // Writes are batched by the poller. Most helpers only mutate memory and the
    // caller decides when to flush to disk.
    async save() {
      await low.write();
    },
    getSightingTimestamps(hex) {
      const sighting = findSighting(hex);
      return Array.isArray(sighting?.timestamps) ? sighting.timestamps : [];
    },
    recordSighting(hex, timestamp) {
      const sighting = ensureSighting(hex);
      sighting.timestamps.push(timestamp);
    },
    getTrackingCount() {
      return low.data.sightings.filter(
        (entry) => Array.isArray(entry.timestamps) && entry.timestamps.length,
      ).length;
    },
    getEnrichment(hex) {
      return low.data.enrichmentCache[hex] ?? null;
    },
    setEnrichment(hex, entry) {
      low.data.enrichmentCache[hex] = entry;
    },
  };
};

export default createDb;
