import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createPoster } from '../src/bluesky.js';

test('createPoster requires credentials', () => {
  assert.throws(
    () => createPoster({ identifier: '', appPassword: '' }),
    /required/i,
  );
});

test('publish posts rich text with link facets and embeds first attachment', async () => {
  const calls = [];
  let logins = 0;
  const fakeAgent = {
    async login() {
      logins += 1;
    },
    async post(payload) {
      calls.push(payload);
    },
  };

  const poster = createPoster({
    identifier: 'test@example.com',
    appPassword: 'pass-1234',
    agentFactory: () => fakeAgent,
  });

  await poster.publish({
    text: 'Check this out https://example.com/track',
    attachments: ['not-a-url', 'https://photos.example.com/image.jpg'],
  });

  assert.equal(logins, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, 'Check this out https://example.com/track');
  assert.ok(Array.isArray(calls[0].facets));
  assert.equal(calls[0].facets.length, 1);
  assert.deepEqual(calls[0].facets[0].features[0], {
    $type: 'app.bsky.richtext.facet#link',
    uri: 'https://example.com/track',
  });
  assert.equal(
    calls[0].embed.external.uri,
    'https://photos.example.com/image.jpg',
  );
});

test('publish enforces Bluesky character limit', async () => {
  const fakeAgent = {
    async login() {},
    async post() {},
  };

  const poster = createPoster({
    identifier: 'limit@example.com',
    appPassword: 'pass-1234',
    agentFactory: () => fakeAgent,
  });

  const overLimit = 'a'.repeat(301);

  await assert.rejects(
    poster.publish({ text: overLimit }),
    /300 character limit/i,
  );
});

test('publish uses image embeds when blob uploads are supported', async () => {
  const calls = [];
  const uploads = [];
  const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type'
          ? 'image/jpeg; charset=UTF-8'
          : null;
      },
    },
    arrayBuffer: async () => imageBytes.buffer,
  });

  const poster = createPoster({
    identifier: 'image@example.com',
    appPassword: 'pass-1234',
    agentFactory: () => ({
      async login() {},
      async uploadBlob(data, { encoding }) {
        uploads.push({ data, encoding });
        return {
          data: {
            blob: {
              $type: 'blob',
              ref: { $link: 'uploaded' },
              mimeType: encoding,
              size: data.length ?? data.byteLength ?? 0,
            },
          },
        };
      },
      async post(payload) {
        calls.push(payload);
      },
    }),
  });

  try {
    await poster.publish({
      text: 'Look at this plane!',
      attachments: ['https://photos.example.com/image.jpg'],
    });
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }

  assert.equal(uploads.length, 1);
  assert.ok(uploads[0].data instanceof Uint8Array);
  assert.equal(uploads[0].encoding, 'image/jpeg');
  assert.equal(calls.length, 1);
  assert.ok(Array.isArray(calls[0].embed.images));
  assert.equal(calls[0].embed.images.length, 1);
  assert.equal(calls[0].embed.images[0].alt, 'Recent aircraft photo');
});
