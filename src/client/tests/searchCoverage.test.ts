// Run with `npm test` (node --test; Node >= 23.6 strips TypeScript types natively).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  combinedDetectionChance,
  formatAge,
  PER_PASS_DETECTION_P,
  recordPass,
  resolveStatus,
  STALE_AFTER_HOURS,
} from '../src/components/search/searchCoverage.ts';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const hoursAgo = (h: number): string => new Date(NOW - h * HOUR).toISOString();

describe('combinedDetectionChance', () => {
  it('matches 1 - (1 - p)^n for a range of p and n', () => {
    for (const p of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
      for (let n = 0; n <= 6; n++) {
        assert.ok(Math.abs(combinedDetectionChance(p, n) - (1 - (1 - p) ** n)) < 1e-12, `p=${p} n=${n}`);
      }
    }
  });

  it('gives known values for p = 0.5', () => {
    assert.equal(combinedDetectionChance(0.5, 0), 0);
    assert.equal(combinedDetectionChance(0.5, 1), 0.5);
    assert.equal(combinedDetectionChance(0.5, 2), 0.75);
    assert.equal(combinedDetectionChance(0.5, 3), 0.875);
  });

  it('never decreases as passes increase', () => {
    let prev = -1;
    for (let n = 0; n < 10; n++) {
      const v = combinedDetectionChance(PER_PASS_DETECTION_P, n);
      assert.ok(v >= prev);
      prev = v;
    }
  });

  it('rejects probabilities outside [0, 1]', () => {
    assert.throws(() => combinedDetectionChance(-0.1, 1), RangeError);
    assert.throws(() => combinedDetectionChance(1.1, 1), RangeError);
  });
});

describe('resolveStatus', () => {
  it('keeps a recent Cleared sector Cleared', () => {
    assert.equal(resolveStatus('Cleared', hoursAgo(STALE_AFTER_HOURS - 0.1), NOW), 'Cleared');
  });

  it('turns Cleared into Stale once the threshold passes', () => {
    assert.equal(resolveStatus('Cleared', hoursAgo(STALE_AFTER_HOURS), NOW), 'Stale');
    assert.equal(resolveStatus('Cleared', hoursAgo(STALE_AFTER_HOURS + 3), NOW), 'Stale');
  });

  it('never marks non-Cleared statuses Stale', () => {
    for (const s of ['Unsearched', 'Searching', 'Lead Found'] as const) {
      assert.equal(resolveStatus(s, hoursAgo(STALE_AFTER_HOURS * 10), NOW), s);
    }
  });

  it('treats a missing timestamp as not stale', () => {
    assert.equal(resolveStatus('Cleared', null, NOW), 'Cleared');
  });
});

describe('recordPass', () => {
  it('increments passCount and resets the stale timer', () => {
    const next = recordPass(2, NOW);
    assert.equal(next.passCount, 3);
    assert.equal(next.lastSearchedAt, new Date(NOW).toISOString());
    assert.equal(resolveStatus('Cleared', next.lastSearchedAt, NOW), 'Cleared');
  });
});

describe('formatAge', () => {
  it('formats hours and minutes', () => {
    assert.equal(formatAge(null, NOW), 'never');
    assert.equal(formatAge(hoursAgo(0), NOW), 'just now');
    assert.equal(formatAge(hoursAgo(5.25), NOW), '5h 15m ago');
  });
});
