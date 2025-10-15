import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  trimTrailingSlash,
  resolveAltitudeFt,
  isGrounded,
  isAboveConfiguredCeiling,
} from '../src/utils.js';

test('trimTrailingSlash removes trailing slashes', () => {
  assert.equal(
    trimTrailingSlash('http://example.com///'),
    'http://example.com',
  );
});

test('trimTrailingSlash leaves untouched strings intact', () => {
  assert.equal(
    trimTrailingSlash('http://example.com/path'),
    'http://example.com/path',
  );
});

test('trimTrailingSlash handles nullish values', () => {
  assert.equal(trimTrailingSlash(null), '');
  assert.equal(trimTrailingSlash(undefined), '');
});

test('resolveAltitudeFt returns numeric altitudes first', () => {
  const plane = { alt_baro: 2500, alt_geom: '2600' };
  assert.equal(resolveAltitudeFt(plane), 2500);
});

test('resolveAltitudeFt falls back to string values', () => {
  const plane = { alt_baro: ' 3000 ', alt_geom: null };
  assert.equal(resolveAltitudeFt(plane), 3000);
});

test('resolveAltitudeFt returns null when nothing usable is present', () => {
  const plane = { alt_baro: 'Ground', alt_geom: 'N/A' };
  assert.equal(resolveAltitudeFt(plane), null);
});

test('isGrounded detects literal ground strings', () => {
  assert.equal(isGrounded({ alt_baro: 'ground' }), true);
  assert.equal(isGrounded({ alt_baro: 'Ground ' }), true);
});

test('isGrounded ignores numeric altitudes', () => {
  assert.equal(isGrounded({ alt_baro: 0 }), false);
  assert.equal(isGrounded({ alt_baro: 120 }), false);
});

test('isAboveConfiguredCeiling honours disabled ceiling', () => {
  assert.equal(isAboveConfiguredCeiling(5000, 0), false);
  assert.equal(isAboveConfiguredCeiling(5000, -10), false);
  assert.equal(isAboveConfiguredCeiling(5000, NaN), false);
});

test('isAboveConfiguredCeiling compares numeric ceilings', () => {
  assert.equal(isAboveConfiguredCeiling(25000, 20000), true);
  assert.equal(isAboveConfiguredCeiling(15000, 20000), false);
  assert.equal(isAboveConfiguredCeiling(null, 20000), false);
});
