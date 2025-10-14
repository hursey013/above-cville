import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { getCarrierCode, shouldIgnoreCarrier } from '../src/filters.js';

test('getCarrierCode returns uppercase prefix', () => {
  assert.equal(getCarrierCode('ual123'), 'UAL');
  assert.equal(getCarrierCode(' Dal456 '), 'DAL');
});

test('getCarrierCode returns null for short or invalid inputs', () => {
  assert.equal(getCarrierCode('AA'), null);
  assert.equal(getCarrierCode(null), null);
  assert.equal(getCarrierCode(undefined), null);
});

test('shouldIgnoreCarrier respects configuration', () => {
  const ignored = ['UAL', 'DAL'];
  assert.equal(shouldIgnoreCarrier('UAL123', ignored), true);
  assert.equal(shouldIgnoreCarrier('DAL456', ignored), true);
  assert.equal(shouldIgnoreCarrier('AAL789', ignored), false);
});

test('shouldIgnoreCarrier treats missing list as opt-in', () => {
  assert.equal(shouldIgnoreCarrier('UAL123', []), false);
  assert.equal(shouldIgnoreCarrier('UAL123', null), false);
});
