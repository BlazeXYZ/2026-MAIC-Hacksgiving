import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

interface TripleTapOptions {
  /** Max gap between taps. The v9 mockup uses 900 ms. */
  windowMs?: number;
  /** A press that moves further than this is a scroll or drag, not a tap. */
  moveTolerancePx?: number;
  /** A press held longer than this is not a deliberate tap. */
  maxPressMs?: number;
}

/**
 * Three deliberate taps in a row call `onTriple` (#10: the Quick Exit return gesture).
 * Single or double taps, scrolling, drags and long presses do nothing.
 * Spread the returned handlers on the element that should listen, e.g. the disguise's header bar.
 */
export function useTripleTap(onTriple: () => void, opts: TripleTapOptions = {}) {
  const { windowMs = 900, moveTolerancePx = 10, maxPressMs = 500 } = opts;
  const count = useRef(0);
  const lastTap = useRef(0);
  const press = useRef<{ x: number; y: number; at: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const reset = useCallback(() => {
    count.current = 0;
    press.current = null;
    clearTimeout(timer.current);
  }, []);

  const onPointerDown = useCallback((e: PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY, at: e.timeStamp };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > moveTolerancePx) reset();
    },
    [moveTolerancePx, reset],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p || e.timeStamp - p.at > maxPressMs) return reset();
      if (count.current > 0 && e.timeStamp - lastTap.current > windowMs) count.current = 0;
      count.current += 1;
      lastTap.current = e.timeStamp;
      clearTimeout(timer.current);
      if (count.current >= 3) {
        reset();
        onTriple();
        return;
      }
      timer.current = setTimeout(() => (count.current = 0), windowMs);
    },
    [maxPressMs, windowMs, onTriple, reset],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset };
}
