import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Quick Exit (#8, #10): the Esc shortcut and the state that shows the delivery-menu cover.
 *
 * The red Exit buttons and Esc call `exit()`. While `exited` is true the app stays mounted but hidden
 * behind `DeliveryCover`, so nothing the person typed or chose is lost. `restore()` (the cover's
 * "Return to Portal" button or three taps on its header bar) brings them back to exactly where they were.
 */
interface QuickExitValue {
  exited: boolean;
  exit: () => void;
  restore: () => void;
  /** Shake the phone to exit. */
  shake: boolean;
  setShake: (on: boolean) => Promise<void>;
}

const QuickExitContext = createContext<QuickExitValue | null>(null);

export function QuickExitProvider({ children }: { children: ReactNode }) {
  const [exited, setExited] = useState(false);

  const exit = useCallback(() => {
    // An open modal <dialog> (e.g. the privacy sheet) makes everything outside it inert, which would freeze the
    // cover and its way back. Close them first; the sheet is transient UI, not something the person typed.
    document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
    try {
      // Replace the current history entry so Back doesn't flip from the cover to the app.
      history.replaceState(null, '', '/');
    } catch {
      // Some embedded webviews block history changes.
    }
    setExited(true);
  }, []);

  const restore = useCallback(() => setExited(false), []);

  // Esc exits from anywhere (#8). Capture phase, so it wins over dialogs and inputs that handle Esc themselves.
  useEffect(() => {
    if (exited) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        exit();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [exited, exit]);

  // Optional shake-to-exit (mockup frame 3). Off by default; iOS asks for motion permission when it's turned on.
  const [shake, setShakeState] = useState(false);
  const setShake = useCallback(async (on: boolean) => {
    if (on) {
      const motion = globalThis.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
      if (motion?.requestPermission) {
        try {
          if ((await motion.requestPermission()) !== 'granted') return;
        } catch {
          return;
        }
      }
    }
    setShakeState(on);
  }, []);

  useEffect(() => {
    if (!shake || exited) return;
    let last = 0;
    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const force = Math.hypot(a.x, a.y, a.z);
      // Roughly 2.5 g: a deliberate shake, not walking or setting the phone down.
      if (force > 25 && e.timeStamp - last > 1000) {
        last = e.timeStamp;
        exit();
      }
    }
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [shake, exited, exit]);

  const value = useMemo(() => ({ exited, exit, restore, shake, setShake }), [exited, exit, restore, shake, setShake]);
  return <QuickExitContext.Provider value={value}>{children}</QuickExitContext.Provider>;
}

export function useQuickExit(): QuickExitValue {
  const ctx = useContext(QuickExitContext);
  if (!ctx) throw new Error('useQuickExit must be used inside <QuickExitProvider>');
  return ctx;
}
