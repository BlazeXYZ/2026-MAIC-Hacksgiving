import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Quick Exit state and the wipe that goes with it (#10).
 *
 * The trigger button and Esc key (#8) call `exit()`. The disguise screen (#9) renders while
 * `exited` is true and puts `useTripleTap(restore)` on its header bar.
 */
interface QuickExitValue {
  exited: boolean;
  /** Bumps on every exit. Use it as a `key` so all form state below it is thrown away. */
  session: number;
  exit: () => void;
  restore: () => void;
  /** Lets modules with their own memory (for example the API mock store) clear themselves on exit. */
  onExit: (fn: () => void) => () => void;
}

const QuickExitContext = createContext<QuickExitValue | null>(null);

/** Removes everything this app could have left in the browser. Runs synchronously so the swap is instant. */
export function flushLocalState(): void {
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      store?.clear();
    } catch {
      // Storage can be blocked (private mode, sandboxed frames). Nothing to clear then.
    }
  }
  try {
    // Replace the current entry so Back does not lead into the crisis app,
    // and drop any path or query that could hint at what was on screen.
    history.replaceState(null, '', '/');
  } catch {
    // Ignore: some embedded webviews block history changes.
  }
}

export function QuickExitProvider({ children }: { children: ReactNode }) {
  const [exited, setExited] = useState(false);
  const [session, setSession] = useState(0);
  const listeners = useRef(new Set<() => void>());

  const exit = useCallback(() => {
    flushLocalState();
    for (const fn of listeners.current) {
      try {
        fn();
      } catch {
        // A failing listener must never stop the exit.
      }
    }
    setSession((n) => n + 1);
    setExited(true);
  }, []);

  const restore = useCallback(() => setExited(false), []);

  const onExit = useCallback((fn: () => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo(() => ({ exited, session, exit, restore, onExit }), [exited, session, exit, restore, onExit]);
  return <QuickExitContext.Provider value={value}>{children}</QuickExitContext.Provider>;
}

export function useQuickExit(): QuickExitValue {
  const ctx = useContext(QuickExitContext);
  if (!ctx) throw new Error('useQuickExit must be used inside <QuickExitProvider>');
  return ctx;
}
