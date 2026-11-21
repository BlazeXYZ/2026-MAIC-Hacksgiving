import { useCallback, useEffect, useState } from 'react';

export interface Loaded<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data when `deps` change and again on `reload()`. Keeps the old data on screen while it refreshes,
 * so a list does not flash empty after every action.
 */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, error, loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; only the listed deps and `reload` should re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** 0.824 -> "82%". */
export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : `${Math.round(value * 100)}%`;
}

/** "expires in 5 days", for an ISO timestamp. */
export function expiresIn(iso: string, now: Date = new Date()): string {
  const days = Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return 'expires today';
  return days === 1 ? 'expires tomorrow' : `expires in ${days} days`;
}

export function kindOfPlace(kind: string): string {
  return kind === 'pantry' ? 'Food pantry' : kind === 'safe-place' ? 'Community safe place' : 'Community place';
}
