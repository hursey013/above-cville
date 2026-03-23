import cron from 'node-cron';

import { createPoster } from './bluesky.js';
import config from './config.js';
import createDb from './db.js';
import logger from './logger.js';
import { createPoller } from './poller.js';

// Polls are scheduled with second-level granularity so the bot can feel near
// real-time without needing a long-running worker queue.
const cronExpression = `*/${config.pollIntervalSeconds} * * * * *`;

// Bootstrap happens once at startup. The modules below stay intentionally small
// and are passed into the poller rather than imported there as singletons.
const db = await createDb({ dataFile: config.dataFile });

let publisher = {
  async publish() {},
};

try {
  publisher = createPoster({
    service: config.bluesky.service,
    identifier: config.bluesky.handle,
    appPassword: config.bluesky.appPassword,
  });
} catch (error) {
  console.warn(`Bluesky posting disabled: ${error.message}`);
}

const poller = createPoller({
  config,
  db,
  publisher,
  logger,
});

logger.info(
  {
    baseUrl: config.aircraftApi.baseUrl,
  },
  'Starting aircraft poller',
);
logger.info(
  {
    latitude: config.latitude,
    longitude: config.longitude,
    radiusNm: config.radius,
    cooldownMinutes: config.cooldownMinutes,
    pollIntervalSeconds: config.pollIntervalSeconds,
    baseUrl: config.aircraftApi.baseUrl,
  },
  'Watching location',
);

cron.schedule(cronExpression, () => {
  poller.runPoll().catch((error) => {
    logger.error({ err: error }, 'Unhandled polling error');
  });
});

await poller.runPoll();
