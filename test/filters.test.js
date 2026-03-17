import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { shouldIgnoreCarrier } from '../src/filters.js';

test('shouldIgnoreCarrier respects configuration', () => {
  const ignored = ['UAL', 'DAL'];
  assert.equal(shouldIgnoreCarrier('UAL123', ignored), true);
  assert.equal(shouldIgnoreCarrier('DAL456', ignored), true);
  assert.equal(shouldIgnoreCarrier('AAL789', ignored), false);
  assert.equal(shouldIgnoreCarrier(' dal456 ', ignored), true);
});

test('shouldIgnoreCarrier treats missing list as opt-in', () => {
  assert.equal(shouldIgnoreCarrier('UAL123', []), false);
  assert.equal(shouldIgnoreCarrier('UAL123', null), false);
  assert.equal(shouldIgnoreCarrier(null, ['UAL']), false);
});
