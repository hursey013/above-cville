import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { trimTrailingSlash } from '../src/utils.js';

test('trimTrailingSlash removes trailing slashes', () => {
  assert.equal(trimTrailingSlash('http://example.com///'), 'http://example.com');
});

test('trimTrailingSlash leaves strings without trailing slashes untouched', () => {
  assert.equal(trimTrailingSlash('http://example.com/path'), 'http://example.com/path');
});

test('trimTrailingSlash handles empty or nullish values', () => {
  assert.equal(trimTrailingSlash(), '');
  assert.equal(trimTrailingSlash(null), '');
});
