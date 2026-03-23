import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  applyEnrichment,
  buildEnrichmentRecord,
  fetchAirplanesLiveEnrichment,
  planeNeedsEnrichment,
  shouldRefreshEnrichment,
} from '../src/enrichment.js';

const originalFetch = global.fetch;

test('planeNeedsEnrichment detects missing app-relevant fields', () => {
  assert.equal(
    planeNeedsEnrichment({
      hex: 'abc123',
      flight: 'DAL123',
      registration: 'N123AB',
      desc: 'BOEING 737-800',
      dbFlags: 1,
      ownOp: 'DELTA AIR LINES',
      category: 'A3',
    }),
    false,
  );

  assert.equal(
    planeNeedsEnrichment({
      hex: 'abc123',
      registration: 'N123AB',
    }),
    true,
  );
});

test('applyEnrichment fills only missing fields', () => {
  const enriched = applyEnrichment(
    {
      hex: 'abc123',
      registration: 'N123AB',
      r: 'N123AB',
      category: 'A2',
    },
    {
      registration: 'N999ZZ',
      flight: 'DAL123',
      desc: 'BOEING 737-800',
      dbFlags: 1,
      ownOp: 'DELTA AIR LINES',
      category: 'A3',
    },
  );

  assert.equal(enriched.registration, 'N123AB');
  assert.equal(enriched.r, 'N123AB');
  assert.equal(enriched.flight, 'DAL123');
  assert.equal(enriched.desc, 'BOEING 737-800');
  assert.equal(enriched.dbFlags, 1);
  assert.equal(enriched.ownOp, 'DELTA AIR LINES');
  assert.equal(enriched.category, 'A2');
});

test('buildEnrichmentRecord keeps only fields useful to this app', () => {
  const record = buildEnrichmentRecord({
    hex: 'abc123',
    flight: 'DAL123',
    r: 'n123ab',
    desc: 'BOEING 737-800',
    ownOp: 'DELTA AIR LINES',
    category: 'A3',
    gs: 120,
  });

  assert.deepEqual(record, {
    flight: 'DAL123',
    registration: 'N123AB',
    desc: 'BOEING 737-800',
    ownOp: 'DELTA AIR LINES',
    category: 'A3',
  });
});

test('shouldRefreshEnrichment honors success TTL and backs off failed lookups', () => {
  const now = Date.parse('2026-03-16T12:00:00.000Z');

  assert.equal(
    shouldRefreshEnrichment({
      cacheEntry: {
        lastSuccessAt: '2026-03-16T11:30:00.000Z',
      },
      now,
      successTtlMs: 60 * 60 * 1000,
    }),
    false,
  );

  assert.equal(
    shouldRefreshEnrichment({
      cacheEntry: {
        lastFailureAt: '2026-03-16T11:00:00.000Z',
      },
      now,
      successTtlMs: 60 * 60 * 1000,
    }),
    false,
  );
});

test('fetchAirplanesLiveEnrichment resolves the matching aircraft from /hex/[hex]', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      ac: [
        {
          hex: 'abc123',
          flight: 'DAL123',
          r: 'N123AB',
          desc: 'BOEING 737-800',
          dbFlags: 1,
          ownOp: 'DELTA AIR LINES',
          category: 'A3',
        },
      ],
    }),
  });

  try {
    const enrichment = await fetchAirplanesLiveEnrichment({
      hex: 'abc123',
    });

    assert.deepEqual(enrichment, {
      flight: 'DAL123',
      registration: 'N123AB',
      desc: 'BOEING 737-800',
      dbFlags: 1,
      ownOp: 'DELTA AIR LINES',
      category: 'A3',
    });
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
