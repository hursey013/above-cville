import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  AIRPLANES_LIVE_SOURCE,
  LOCAL_READSB_SOURCE,
  fetchAircraftSnapshot,
  resolveSourceName,
} from '../src/aircraftSource.js';

const originalFetch = global.fetch;

test('resolveSourceName keeps airplanes.live as the default source', () => {
  assert.equal(resolveSourceName(''), AIRPLANES_LIVE_SOURCE);
  assert.equal(resolveSourceName('airplanes_live'), AIRPLANES_LIVE_SOURCE);
  assert.equal(resolveSourceName('airplanes.live'), AIRPLANES_LIVE_SOURCE);
});

test('resolveSourceName accepts readsb aliases', () => {
  assert.equal(resolveSourceName('readsb'), LOCAL_READSB_SOURCE);
  assert.equal(resolveSourceName('local'), LOCAL_READSB_SOURCE);
  assert.equal(resolveSourceName('local-api'), LOCAL_READSB_SOURCE);
});

test('fetchAircraftSnapshot reads airplanes.live payloads without reshaping them', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        ac: [{ hex: 'abc123', flight: 'DAL123', registration: 'N123AB' }],
      }),
    };
  };

  try {
    const snapshot = await fetchAircraftSnapshot({
      source: 'airplanes.live',
      baseUrl: 'https://api.airplanes.live/v2',
      latitude: 38.0375,
      longitude: -78.4863,
      radius: 5,
    });

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://api.airplanes.live/v2/point/38.0375/-78.4863/5',
    );
    assert.equal(snapshot.source, AIRPLANES_LIVE_SOURCE);
    assert.equal(snapshot.aircraft[0].registration, 'N123AB');
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});

test('fetchAircraftSnapshot normalizes readsb payloads', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      now: 1713811200,
      aircraft: [
        {
          hex: 'abc123',
          r: 'N123AB',
          gs: 120,
          alt_baro: 2500,
          track: 90,
        },
      ],
    }),
  });

  try {
    const snapshot = await fetchAircraftSnapshot({
      source: 'readsb',
      baseUrl: 'http://feeder.local:30152',
      latitude: 38.0375,
      longitude: -78.4863,
      radius: 5,
    });

    assert.equal(snapshot.source, LOCAL_READSB_SOURCE);
    assert.equal(snapshot.aircraft[0].registration, 'N123AB');
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
