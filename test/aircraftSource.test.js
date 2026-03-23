import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildReadsbUrl,
  fetchAircraftSnapshot,
} from '../src/aircraftSource.js';

const originalFetch = global.fetch;

test('buildReadsbUrl builds a circle query for the local feeder', () => {
  assert.equal(
    buildReadsbUrl({
      baseUrl: 'http://feeder.local:30152/',
      latitude: 38.0375,
      longitude: -78.4863,
      radius: 5,
    }),
    'http://feeder.local:30152?circle=38.0375,-78.4863,5',
  );
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
      baseUrl: 'http://feeder.local:30152',
      latitude: 38.0375,
      longitude: -78.4863,
      radius: 5,
    });

    assert.equal(snapshot.aircraft[0].registration, 'N123AB');
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
