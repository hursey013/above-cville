import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createPoller } from '../src/poller.js';

const originalFetch = global.fetch;

const createLogger = () => ({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

const createDb = () => ({
  getEnrichment() {
    return null;
  },
  setEnrichment() {},
  getSightingTimestamps() {
    return [];
  },
  recordSighting() {
    throw new Error('recordSighting should not be called for ignored planes');
  },
  async save() {},
  getTrackingCount() {
    return 0;
  },
});

test('readsb planes are filtered after enrichment fills an ignored carrier callsign', async () => {
  const publishes = [];

  global.fetch = async (url) => {
    if (String(url).includes('?circle=')) {
      return {
        ok: true,
        json: async () => ({
          aircraft: [
            {
              hex: 'ad071d',
              r: 'N939AE',
              alt_baro: 3900,
              gs: 246.4,
              track: 42.04,
            },
          ],
        }),
      };
    }

    if (String(url).endsWith('/hex/ad071d')) {
      return {
        ok: true,
        json: async () => ({
          ac: [
            {
              hex: 'ad071d',
              flight: 'PDT5973',
              r: 'N939AE',
              desc: 'EMBRAER ERJ-145',
              ownOp: 'AMERICAN AIRLINES INC',
              category: 'A2',
            },
          ],
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const poller = createPoller({
      config: {
        aircraftApi: {
          source: 'readsb',
          baseUrl: 'http://feeder.local:30152',
          enrichmentTtlMinutes: 60,
        },
        latitude: 38.0375,
        longitude: -78.4863,
        radius: 5,
        cooldownMinutes: 10,
        maxAltitudeFt: 25000,
        ignoredCarrierCodes: ['PDT'],
        aircraftLinkBase: 'https://globe.airplanes.live/?icao=',
      },
      db: createDb(),
      publisher: {
        isDryRun: false,
        async publish(payload) {
          publishes.push(payload);
        },
      },
      logger: createLogger(),
    });

    await poller.runPoll();
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }

  assert.equal(publishes.length, 0);
});
