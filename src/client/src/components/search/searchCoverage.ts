// Pure helpers for sector staleness and repeat-pass coverage on the search grid.
// Kept free of runtime imports so `node --test` can load it directly
// (see src/client/tests/searchCoverage.test.ts).
import type { SectorStatus } from './searchGrid';

/** A Cleared sector is shown as Stale once this many hours pass without a new pass. */
export const STALE_AFTER_HOURS = 4;

/**
 * ASSUMPTION: chance that one volunteer pass over a sector finds the person, if
 * they are there. This is a planning placeholder, not a measured value; real
 * per-pass detection depends on terrain, spacing, light, and searcher training.
 */
export const PER_PASS_DETECTION_P = 0.5;

const HOUR_MS = 60 * 60 * 1000;

/** Combined chance of detection after `passes` independent passes: 1 - (1 - p)^n. */
export function combinedDetectionChance(p: number, passes: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError(`per-pass probability must be within [0, 1], got ${p}`);
  }
  const n = Math.max(0, Math.floor(passes));
  return 1 - Math.pow(1 - p, n);
}

/** True when the last pass is at least `staleAfterHours` old. */
export function isStale(
  lastSearchedAt: string | null,
  nowMs: number,
  staleAfterHours: number = STALE_AFTER_HOURS,
): boolean {
  if (!lastSearchedAt) return false;
  const last = Date.parse(lastSearchedAt);
  if (Number.isNaN(last)) return false;
  return nowMs - last >= staleAfterHours * HOUR_MS;
}

/** Status to display: a stored Cleared status decays to Stale over time. */
export function resolveStatus(
  status: SectorStatus,
  lastSearchedAt: string | null,
  nowMs: number,
  staleAfterHours: number = STALE_AFTER_HOURS,
): SectorStatus {
  if (status === 'Cleared' && isStale(lastSearchedAt, nowMs, staleAfterHours)) {
    return 'Stale';
  }
  return status;
}

/** Fields to apply when a sector is marked Cleared: one more pass, timer reset. */
export function recordPass(passCount: number, nowMs: number): { passCount: number; lastSearchedAt: string } {
  return { passCount: passCount + 1, lastSearchedAt: new Date(nowMs).toISOString() };
}

/** Short relative label such as "5h 10m ago". */
export function formatAge(lastSearchedAt: string | null, nowMs: number): string {
  if (!lastSearchedAt) return 'never';
  const last = Date.parse(lastSearchedAt);
  if (Number.isNaN(last)) return 'unknown';
  const minutes = Math.max(0, Math.floor((nowMs - last) / 60000));
  if (minutes < 1) return 'just now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
}
