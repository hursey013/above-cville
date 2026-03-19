import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { getCarrierCode, shouldIgnoreCarrier } from '../src/filters.js';

test('getCarrierCode trims and uppercases callsigns', () => {
  assert.equal(getCarrierCode('PDT5973'), 'PDT');
  assert.equal(getCarrierCode(' pdt5973  '), 'PDT');
  assert.equal(getCarrierCode('AB'), null);
  assert.equal(getCarrierCode(null), null);
});

test('shouldIgnoreCarrier respects configuration', () => {
  const ignored = ['UAL', 'DAL'];
  assert.equal(shouldIgnoreCarrier('UAL123', ignored), true);
  assert.equal(shouldIgnoreCarrier('DAL456', ignored), true);
  assert.equal(shouldIgnoreCarrier('PDT5973', ['PDT']), true);
  assert.equal(shouldIgnoreCarrier('AAL789', ignored), false);
  assert.equal(shouldIgnoreCarrier(' dal456 ', ignored), true);
});

test('shouldIgnoreCarrier treats missing list as opt-in', () => {
  assert.equal(shouldIgnoreCarrier('UAL123', []), false);
  assert.equal(shouldIgnoreCarrier('UAL123', null), false);
  assert.equal(shouldIgnoreCarrier(null, ['UAL']), false);
});
