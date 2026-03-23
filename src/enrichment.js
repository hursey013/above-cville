import logger from './logger.js';
import { normalizeHex, normalizeRegistration } from './utils.js';

const AIRPLANES_LIVE_ENRICHMENT_BASE = 'https://api.airplanes.live/v2';
const ENRICHMENT_USER_AGENT =
  'above-cville/2.0.0 (+https://github.com/hursey013/above-cville)';

// These are the extra fields that improve posts and filtering when the local
// readsb feed does not include the same metadata that airplanes.live does.
const ENRICHMENT_FIELDS = [
  {
    key: 'flight',
    sourceFields: ['flight'],
  },
  {
    key: 'registration',
    sourceFields: ['registration', 'r'],
    normalize: (value) => normalizeRegistration(value) || null,
  },
  {
    key: 'desc',
    sourceFields: ['desc'],
  },
  {
    key: 'dbFlags',
    sourceFields: ['dbFlags'],
  },
  {
    key: 'ownOp',
    sourceFields: ['ownOp'],
  },
  {
    key: 'category',
    sourceFields: ['category'],
  },
];

const hasMeaningfulValue = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== undefined && value !== null;
};

const readFieldValue = (record, fields = []) => {
  for (const field of fields) {
    if (hasMeaningfulValue(record?.[field])) {
      return record[field];
    }
  }
  return null;
};

/**
 * Decide whether a plane is missing any fields that are worth fetching from
 * airplanes.live. This keeps enrichment focused on metadata, not telemetry.
 */
export const planeNeedsEnrichment = (plane) =>
  ENRICHMENT_FIELDS.some((descriptor) => {
    const value = readFieldValue(plane, descriptor.sourceFields);
    return !hasMeaningfulValue(value);
  });

// The cache stores only the subset of fields this app actually uses so the JSON
// file stays small and easy to inspect by hand.
export const buildEnrichmentRecord = (plane) => {
  const enrichment = {};

  for (const descriptor of ENRICHMENT_FIELDS) {
    const rawValue = readFieldValue(plane, descriptor.sourceFields);
    if (!hasMeaningfulValue(rawValue)) {
      continue;
    }

    const normalized = descriptor.normalize
      ? descriptor.normalize(rawValue)
      : typeof rawValue === 'string'
        ? rawValue.trim()
        : rawValue;

    if (!hasMeaningfulValue(normalized)) {
      continue;
    }

    enrichment[descriptor.key] = normalized;
  }

  return enrichment;
};

// Merge enrichment data conservatively: never overwrite values we already have
// from the live snapshot.
export const applyEnrichment = (plane, enrichment) => {
  if (!plane || typeof plane !== 'object') {
    return plane;
  }

  if (!enrichment || typeof enrichment !== 'object') {
    return plane;
  }

  const merged = { ...plane };

  for (const descriptor of ENRICHMENT_FIELDS) {
    const existingValue = readFieldValue(merged, descriptor.sourceFields);
    if (hasMeaningfulValue(existingValue)) {
      continue;
    }

    const enrichmentValue = enrichment[descriptor.key];
    if (!hasMeaningfulValue(enrichmentValue)) {
      continue;
    }

    merged[descriptor.key] = enrichmentValue;
    if (descriptor.key === 'registration' && !hasMeaningfulValue(merged.r)) {
      merged.r = enrichmentValue;
    }
  }

  return merged;
};

// Successful lookups honor the configured TTL. Failed lookups back off for a
// day so we do not hammer airplanes.live for the same missing aircraft.
export const shouldRefreshEnrichment = ({ cacheEntry, now, successTtlMs }) => {
  if (!cacheEntry || typeof cacheEntry !== 'object') {
    return true;
  }

  if (cacheEntry.lastSuccessAt) {
    const ageMs = now - Date.parse(cacheEntry.lastSuccessAt);
    return !Number.isFinite(ageMs) || ageMs >= successTtlMs;
  }

  if (cacheEntry.lastFailureAt) {
    const ageMs = now - Date.parse(cacheEntry.lastFailureAt);
    return !Number.isFinite(ageMs) || ageMs >= 24 * 60 * 60 * 1000;
  }

  return true;
};

/**
 * Apply cached enrichment first, then decide whether a fresh network lookup is
 * still needed. The poller uses `requestUsed` to enforce a global per-poll cap.
 */
export const enrichPlane = async ({
  plane,
  now,
  cacheEntry,
  successTtlMs,
  allowRequest = true,
}) => {
  if (!planeNeedsEnrichment(plane)) {
    return {
      plane,
      cacheEntry,
      requestUsed: false,
    };
  }

  const cachedPlane = cacheEntry?.data
    ? applyEnrichment(plane, cacheEntry.data)
    : plane;
  const needsRefresh = shouldRefreshEnrichment({
    cacheEntry,
    now,
    successTtlMs,
  });

  if (!planeNeedsEnrichment(cachedPlane) && !needsRefresh) {
    return {
      plane: cachedPlane,
      cacheEntry,
      requestUsed: false,
    };
  }

  if (!needsRefresh || !allowRequest) {
    return {
      plane: cachedPlane,
      cacheEntry,
      requestUsed: false,
    };
  }

  try {
    const enrichment = await fetchAirplanesLiveEnrichment({
      hex: plane.hex,
    });

    return {
      plane: applyEnrichment(plane, enrichment),
      cacheEntry: {
        hex: plane.hex,
        data: enrichment ?? {},
        lastSuccessAt: new Date(now).toISOString(),
        lastFailureAt: null,
      },
      requestUsed: true,
    };
  } catch (error) {
    logger.warn(
      {
        err: error,
        hex: plane.hex,
        source: 'airplanes.live',
      },
      'Failed to fetch airplanes.live enrichment',
    );

    return {
      plane: cachedPlane,
      cacheEntry: {
        hex: plane.hex,
        data: cacheEntry?.data ?? {},
        lastSuccessAt: cacheEntry?.lastSuccessAt ?? null,
        lastFailureAt: new Date(now).toISOString(),
      },
      requestUsed: true,
    };
  }
};

export const fetchAirplanesLiveEnrichment = async ({ hex }) => {
  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) {
    return null;
  }

  const url = `${AIRPLANES_LIVE_ENRICHMENT_BASE}/hex/${normalizedHex}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': ENRICHMENT_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(
      `airplanes.live enrichment responded with status ${response.status}`,
    );
  }

  const payload = await response.json();
  const aircraft = Array.isArray(payload?.ac) ? payload.ac : [];
  const match =
    aircraft.find(
      (candidate) => normalizeHex(candidate?.hex) === normalizedHex,
    ) ??
    aircraft[0] ??
    null;

  if (!match) {
    return null;
  }

  const enrichment = buildEnrichmentRecord(match);

  logger.info(
    {
      source: 'airplanes.live',
      endpoint: '/hex/[hex]',
      hex: normalizedHex,
      url,
      enrichedKeys: Object.keys(enrichment),
    },
    'Fetched airplanes.live enrichment data',
  );

  return enrichment;
};

export {
  AIRPLANES_LIVE_ENRICHMENT_BASE,
  ENRICHMENT_FIELDS,
  ENRICHMENT_USER_AGENT,
  hasMeaningfulValue,
  readFieldValue,
};
