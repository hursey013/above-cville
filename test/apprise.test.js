import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createAppriseClient } from '../src/apprise.js';

const originalFetch = global.fetch;
const okResponse = {
  ok: true,
  status: 200,
  text: async () => ''
};

test('createAppriseClient requires an API URL', () => {
  assert.throws(() => createAppriseClient({ apiUrl: '' }), /required/i);
});

test('send throws when no URLs or config key are provided', async () => {
  const client = createAppriseClient({ apiUrl: 'http://example.com/notify' });
  await assert.rejects(
    client.send({ title: 'Missing', body: 'No destination' }),
    /No Apprise destination/i
  );
});

test('send posts to trimmed base URL with unique targets', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({
      url,
      options: {
        ...options,
        body: JSON.parse(options.body)
      }
    });
    return okResponse;
  };

  try {
    const client = createAppriseClient({
      apiUrl: 'http://example.com/notify///',
      urls: ['  discord://token  ', 'discord://token']
    });

    await client.send({ title: 'Flight spotted', body: 'Body text', attachments: ['https://example.com/a.jpg'] });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://example.com/notify');
    assert.deepEqual(calls[0].options.body.urls, ['discord://token']);
    assert.equal(calls[0].options.body.title, 'Flight spotted');
    assert.deepEqual(calls[0].options.body.attachments, ['https://example.com/a.jpg']);
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
      options: {
        ...options,
        body: JSON.parse(options.body)
      }
    });
    return okResponse;
  };

  try {
    const client = createAppriseClient({
      apiUrl: 'http://example.com/notify',
      configKey: 'alerts/team'
    });

    await client.send({ title: 'Flight spotted', body: 'Body text' });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://example.com/notify/alerts%2Fteam');
    assert.ok(!('urls' in calls[0].options.body));
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
