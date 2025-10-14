import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { fetchPlanePhotoUrl } from '../src/photos.js';

const originalFetch = global.fetch;

const createOkResponse = (body) => ({
  ok: true,
  status: 200,
  text: async () => body
});

const defaultMeta =
  '<meta property="og:image" content="https://www.flightaware.com/images/og_default_image.png">';

test('fetchPlanePhotoUrl returns null when registration missing', async () => {
  global.fetch = async () => {
    throw new Error('should not fetch');
  };

  try {
    const result = await fetchPlanePhotoUrl('');
    assert.equal(result, null);
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});

test('fetchPlanePhotoUrl extracts og:image when present', async () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://cdn.example.com/photo.jpg">
      </head>
      <body></body>
    </html>
  `;

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return createOkResponse(html);
  };

  try {
    const result = await fetchPlanePhotoUrl('n123ab');
    assert.equal(result, 'https://cdn.example.com/photo.jpg');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('N123AB'));
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});

test('fetchPlanePhotoUrl ignores default image', async () => {
  global.fetch = async () => createOkResponse(`<head>${defaultMeta}</head>`);

  try {
    const result = await fetchPlanePhotoUrl('N777AA');
    assert.equal(result, null);
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
