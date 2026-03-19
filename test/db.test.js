import { strict as assert } from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { test } from 'node:test';

import { createDb } from '../src/db.js';

const createTempDataFile = async (name, payload) => {
  const dir = path.join(process.cwd(), 'tmp', 'db-tests');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, JSON.stringify(payload, null, 2));
  return file;
};

test('createDb migrates legacy split sightings and enrichment cache by hex', async () => {
  const file = await createTempDataFile('legacy-split.json', {
    sightings: [
      {
        hex: 'AD071D',
        timestamps: [1000, 2000],
      },
    ],
    enrichmentCache: {
      ad071d: {
        flight: 'PDT5973',
        registration: 'N939AE',
      },
    },
  });

  const db = await createDb({ dataFile: file });

  assert.deepEqual(db.getSightingTimestamps('ad071d'), [1000, 2000]);
  assert.deepEqual(db.getEnrichment('AD071D'), {
    flight: 'PDT5973',
    registration: 'N939AE',
  });

  db.recordSighting('ad071d', 3000);
  db.setEnrichment('ad071d', {
    flight: 'PDT5973',
    registration: 'N939AE',
    desc: 'EMBRAER ERJ-145',
  });
  await db.save();

  const written = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.deepEqual(written, {
    ad071d: {
      timestamps: [1000, 2000, 3000],
      enrichment: {
        flight: 'PDT5973',
        registration: 'N939AE',
        desc: 'EMBRAER ERJ-145',
      },
    },
  });
});

test('createDb reads already-migrated per-hex records safely', async () => {
  const file = await createTempDataFile('per-hex.json', {
    ad071d: {
      timestamps: [1000],
      enrichment: {
        flight: 'PDT5973',
      },
    },
    badkey: {
      timestamps: ['oops'],
    },
  });

  const db = await createDb({ dataFile: file });

  assert.deepEqual(db.getSightingTimestamps('ad071d'), [1000]);
  assert.deepEqual(db.getEnrichment('ad071d'), {
    flight: 'PDT5973',
  });
  assert.equal(db.getTrackingCount(), 1);
});

test('createDb falls back to legacy apiDiagnostics enrichment cache', async () => {
  const file = await createTempDataFile('legacy-nested.json', {
    sightings: [
      {
        hex: 'abc123',
        timestamps: [42],
      },
    ],
    apiDiagnostics: {
      enrichmentCache: {
        abc123: {
          ownOp: 'DELTA AIR LINES',
        },
      },
    },
  });

  const db = await createDb({ dataFile: file });

  assert.deepEqual(db.getSightingTimestamps('abc123'), [42]);
  assert.deepEqual(db.getEnrichment('abc123'), {
    ownOp: 'DELTA AIR LINES',
  });
});
