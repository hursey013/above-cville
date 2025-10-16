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
