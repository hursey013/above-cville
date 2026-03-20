import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createPoster } from '../src/bluesky.js';
import { BskyAgent } from '../vendor/atproto-api/index.js';

test('createPoster requires credentials', () => {
  assert.throws(
    () => createPoster({ identifier: '', appPassword: '' }),
    /required/i,
  );
});

test('createPoster dry run logs instead of posting and does not require credentials', async () => {
  const payloads = [];

  const poster = createPoster({
    dryRun: true,
    onDryRun: async (payload) => {
      payloads.push(payload);
    },
  });

  await poster.publish({
    text: 'Check this out #N100CV',
    attachments: ['https://photos.example.com/image.jpg'],
  });

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].text, 'Check this out #N100CV');
  assert.deepEqual(payloads[0].attachments, [
    {
      url: 'https://photos.example.com/image.jpg',
      altText: null,
    },
  ]);
});

test('publish posts rich text with link and hashtag facets and embeds first attachment', async () => {
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
    text: 'Check this out #N100CV https://example.com/track',
    attachments: ['not-a-url', 'https://photos.example.com/image.jpg'],
  });

  assert.equal(logins, 1);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].text,
    'Check this out #N100CV https://example.com/track',
  );
  assert.ok(Array.isArray(calls[0].facets));
  assert.equal(calls[0].facets.length, 2);
  const linkFacet = calls[0].facets.find(
    (facet) => facet.features?.[0]?.$type === 'app.bsky.richtext.facet#link',
  );
  const hashtagFacet = calls[0].facets.find(
    (facet) => facet.features?.[0]?.$type === 'app.bsky.richtext.facet#tag',
  );
  assert.ok(linkFacet);
  assert.ok(hashtagFacet);
  assert.deepEqual(linkFacet.features[0], {
    $type: 'app.bsky.richtext.facet#link',
    uri: 'https://example.com/track',
  });
  assert.deepEqual(hashtagFacet.features[0], {
    $type: 'app.bsky.richtext.facet#tag',
    tag: 'N100CV',
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

test('publish falls back to an external card when the image is too large', async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'image/jpeg' : null;
      },
    },
    arrayBuffer: async () => new ArrayBuffer(999425),
  });

  const poster = createPoster({
    identifier: 'image@example.com',
    appPassword: 'pass-1234',
    agentFactory: () => ({
      async login() {},
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

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].embed.external.uri,
    'https://photos.example.com/image.jpg',
  );
});

test('createPoster normalizes the public Bluesky web host to the API service host', async () => {
  let receivedService = null;
  let logins = 0;

  const poster = createPoster({
    service: 'https://bsky.app',
    identifier: 'test@example.com',
    appPassword: 'pass-1234',
    agentFactory: (serviceUrl) => {
      receivedService = serviceUrl;
      return {
        async login() {
          logins += 1;
        },
        async post() {},
      };
    },
  });

  await poster.publish({ text: 'hello' });

  assert.equal(receivedService, 'https://bsky.social');
  assert.equal(logins, 1);
});

test('BskyAgent uses the PDS endpoint from createSession for repo writes', async () => {
  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (input, init = {}) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input?.url;
    requests.push({ url, method: init.method ?? 'GET' });

    if (url.endsWith('/xrpc/com.atproto.server.createSession')) {
      return {
        ok: true,
        json: async () => ({
          did: 'did:plc:test123',
          handle: 'test.example.com',
          accessJwt: 'access',
          refreshJwt: 'refresh',
          didDoc: {
            service: [
              {
                id: '#atproto_pds',
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: 'https://morel.us-east.host.bsky.network',
              },
            ],
          },
        }),
      };
    }

    if (url.endsWith('/xrpc/com.atproto.repo.createRecord')) {
      return {
        ok: true,
        json: async () => ({
          uri: 'at://did:plc:test123/app.bsky.feed.post/1',
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: 'test@example.com',
      password: 'pass-1234',
    });
    await agent.post({
      text: 'hello',
      facets: [],
    });
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }

  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].url,
    'https://bsky.social/xrpc/com.atproto.server.createSession',
  );
  assert.equal(
    requests[1].url,
    'https://morel.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord',
  );
});
