import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { fetchPlanePhotoUrl } from '../src/photos.js';

const originalFetch = global.fetch;

const createOkResponse = (body) => ({
  ok: true,
  status: 200,
  text: async () => body,
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

test('fetchPlanePhotoUrl follows first FlightAware detail page and prefers xga image', async () => {
  const galleryHtml = `
    <html>
      <head>${defaultMeta}</head>
      <body>
        <a href="/photos/view/744217-abcdef/aircraft/N3275F/sort/votes/page/1">
          First photo
        </a>
      </body>
    </html>
  `;

  const detailHtml = `
    <html>
      <head>
        <meta property="og:image" content="https://photos.flightaware.com/photos/retriever/LARGEIMAGE123">
      </head>
      <body>
        <span id="photo_size_selectors">
          <a data-size="xga" data-imgsrc="https://photos.flightaware.com/photos/retriever/LARGEIMAGE123">large</a>
          <a data-size="fullsize" data-imgsrc="https://photos.flightaware.com/photos/retriever/FULLSIZE456">full</a>
        </span>
      </body>
    </html>
  `;

  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/photos/aircraft/N3275F/sort/date')) {
      return createOkResponse(galleryHtml);
    }
    if (
      String(url).includes(
        '/photos/view/744217-abcdef/aircraft/N3275F/sort/votes/page/1',
      )
    ) {
      return createOkResponse(detailHtml);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const result = await fetchPlanePhotoUrl('N3275F');
    assert.equal(
      result,
      'https://photos.flightaware.com/photos/retriever/LARGEIMAGE123',
    );
    assert.equal(calls.length, 2);
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

test('fetchPlanePhotoUrl falls back to FlightAware retriever image in page body', async () => {
  const html = `
    <html>
      <head>${defaultMeta}</head>
      <body>
        <img src="https://photos.flightaware.com/photos/retriever/c6f7998e365471484d1959581a36fca03281f150">
      </body>
    </html>
  `;

  global.fetch = async () => createOkResponse(html);

  try {
    const result = await fetchPlanePhotoUrl('N729CD');
    assert.equal(
      result,
      'https://photos.flightaware.com/photos/retriever/c6f7998e365471484d1959581a36fca03281f150',
    );
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});

test('fetchPlanePhotoUrl ignores retriever images inside noscript', async () => {
  const html = `
    <html>
      <head>${defaultMeta}</head>
      <body>
        <noscript>
          <img src="https://photos.flightaware.com/photos/retriever/LOWQUALITY123">
        </noscript>
        <img src="https://photos.flightaware.com/photos/retriever/HIGHQUALITY456">
      </body>
    </html>
  `;

  global.fetch = async () => createOkResponse(html);

  try {
    const result = await fetchPlanePhotoUrl('N730CD');
    assert.equal(
      result,
      'https://photos.flightaware.com/photos/retriever/HIGHQUALITY456',
    );
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }
});
