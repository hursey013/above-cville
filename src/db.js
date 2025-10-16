import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';

import config from './config.js';

const dataFilePath = resolve(process.cwd(), config.dataFile);

/**
 * Ensure the JSON backing file exists before lowdb tries to read from it.
 */
const ensureStorage = async () => {
  const dir = dirname(dataFilePath);
  await fs.mkdir(dir, { recursive: true });
};

await ensureStorage();

const adapter = new JSONFile(dataFilePath);
const defaultData = {
  sightings: [],
};

const db = new Low(adapter, defaultData);
await db.read();

if (!db.data) {
  db.data = defaultData;
}

export default db;
