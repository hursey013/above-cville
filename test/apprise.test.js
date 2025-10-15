import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createNotifier } from '../src/apprise.js';

const originalFetch = global.fetch;
const okResponse = {
  ok: true,
  status: 200,
  text: async () => '',
};

test('createNotifier requires an API URL', () => {
  assert.throws(() => createNotifier({ apiUrl: '' }), /required/i);
});

test('send throws when no URLs or config key are provided', async () => {
  const client = createNotifier({ apiUrl: 'http://example.com/notify' });
  await assert.rejects(
    client.sendNotification({ title: 'Missing', body: 'No destination' }),
    /No Apprise destination/i,
  );
});

test('send posts to trimmed base URL with unique targets', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({
      url,
      options,
    });
    return {
      ok: true,
      status: 200,
      text: async () => '',
    };
  };

  try {
    const client = createNotifier({
      apiUrl: 'http://example.com/notify///',
      urls: ['  discord://token  ', 'discord://token'],
    });

    await client.sendNotification({
      title: 'Flight spotted',
      body: 'Body text',
      attachments: ['https://example.com/a.jpg'],
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://example.com/notify');
    const body = calls[0].options.body;
    assert.ok(
      body instanceof FormData,
      'Expected FormData payload when attachments provided',
    );
    const entries = Array.from(body.entries());
    const mapped = Object.fromEntries(
      entries.map(([key, value]) => [key, value]),
    );
    assert.equal(mapped.urls, 'discord://token');
    assert.equal(mapped.title, 'Flight spotted');
    assert.equal(mapped.body, 'Body text');
    assert.equal(mapped.attachment, 'https://example.com/a.jpg');
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});

test('send uses config key endpoints when provided', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({
      url,
      options,
    });
    return okResponse;
  };

  try {
    const client = createNotifier({
      apiUrl: 'http://example.com/notify',
      configKey: 'alerts/team',
    });

    await client.sendNotification({
      title: 'Flight spotted',
      body: 'Body text',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://example.com/notify/alerts%2Fteam');
    const body = JSON.parse(calls[0].options.body);
    assert.ok(!('urls' in body));
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
