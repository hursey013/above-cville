import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  composeNotificationMessage,
  summarizeSightings,
} from '../src/messages.js';

const buildTimestamps = (now, offsets) => offsets.map((offset) => now - offset);

test('summarizeSightings tallies recent activity windows', () => {
  const now = Date.now();
  const timestamps = buildTimestamps(
    now,
    [500, 2_000, 3_000, 50_000, 200_000, 2_000_000],
  );
  const stats = summarizeSightings(timestamps, now);
  assert.equal(stats.total, 6);
  assert.equal(stats.lastHour, 6);
  assert.equal(stats.lastDay, 6);
  assert.equal(stats.lastWeek, 6);
  assert.ok(stats.lastSeen);
  assert.ok(stats.firstSeen);
  assert.ok(Number.isFinite(stats.averageIntervalMs));
});

test('composeNotificationMessage highlights first-time sightings', () => {
  const now = Date.now();
  const plane = {
    hex: 'abc123',
    flight: 'N100CV',
    gs: 110,
    alt_baro: 1800,
    track: 270,
  };
  const { title, body } = composeNotificationMessage(plane, [now], now);
  assert.match(title, /N100CV/i);
  assert.match(body, /first time/i);
  assert.match(body, /west/i);
});

test('composeNotificationMessage references frequent visitors', () => {
  const now = Date.now();
  const recentOffsets = Array.from(
    { length: 4 },
    (_, idx) => idx * 10 * 60 * 1000,
  ); // every 10 minutes
  const timestamps = buildTimestamps(now, recentOffsets);
  const plane = {
    hex: 'def456',
    registration: 'N200CV',
    gs: 180,
    alt_baro: 4200,
    track: 45,
  };
  const { body } = composeNotificationMessage(plane, timestamps, now);
  assert.match(body, /laps|busy|regular/i);
  assert.match(body, /north/i);
});
