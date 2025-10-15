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
    desc: 'CIRRUS SR22',
    category: 'A1',
  };
  const { title, body } = composeNotificationMessage(plane, [now], now);
  assert.match(title, /N100CV/i);
  assert.match(body, /first time/i);
  assert.match(body, /Cirrus SR22 \(Light\)/);
  assert.match(body, /west/i);
  assert.match(body, /https:\/\/globe\.airplanes\.live\/\?icao=abc123$/);
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
    desc: 'CESSNA 172 SKYHAWK',
    category: 'A2',
  };
  const { body } = composeNotificationMessage(plane, timestamps, now);
  assert.match(body, /laps|busy|regular/i);
  assert.match(body, /north/i);
  assert.match(body, /Cessna 172 Skyhawk \(Small\)/);
  assert.match(body, /https:\/\/globe\.airplanes\.live\/\?icao=def456$/);
});

test('composeNotificationMessage truncates long bodies to Bluesky limits', () => {
  const now = Date.now();
  const plane = {
    hex: 'long1',
    registration: 'N777LF',
    gs: 220,
    alt_baro: 2500,
    track: 90,
    desc: Array(40).fill('GULFSTREAM G650').join(' '),
    category: 'A5',
  };
  const { body } = composeNotificationMessage(plane, [now], now);
  assert.ok(body.length <= 300);
  assert.match(body, /…/);
  assert.ok(body.endsWith('https://globe.airplanes.live/?icao=long1'));
});
