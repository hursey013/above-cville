import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createHealthcheckNotifier } from '../src/healthchecks.js';

const createLogger = () => ({
  warn() {},
});

test('healthcheck success pings are rate-limited independently of poll frequency', async () => {
  const calls = [];
  let currentTime = 1_000;

  const notifier = createHealthcheckNotifier({
    pingUrl: 'https://hc-ping.com/test-uuid',
    successIntervalSeconds: 60,
    now: () => currentTime,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    },
    loggerInstance: createLogger(),
  });

  await notifier.notifyHealthcheckSuccess({ poll: 1 });

  currentTime += 1_000;
  await notifier.notifyHealthcheckSuccess({ poll: 2 });

  currentTime += 60_000;
  await notifier.notifyHealthcheckSuccess({ poll: 3 });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://hc-ping.com/test-uuid');
  assert.equal(calls[1].url, 'https://hc-ping.com/test-uuid');
});

test('healthcheck failure pings are not rate-limited by the success interval', async () => {
  const calls = [];
  let currentTime = 1_000;

  const notifier = createHealthcheckNotifier({
    pingUrl: 'https://hc-ping.com/test-uuid',
    successIntervalSeconds: 60,
    now: () => currentTime,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    },
    loggerInstance: createLogger(),
  });

  await notifier.notifyHealthcheckSuccess({ poll: 1 });
  currentTime += 1_000;
  await notifier.notifyHealthcheckFailure({ error: 'boom' });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://hc-ping.com/test-uuid');
  assert.equal(calls[1].url, 'https://hc-ping.com/test-uuid/fail');
});
