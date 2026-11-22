import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { LogoMark } from '../components/ui/Icon';
import { serverUrl, validateServer, type SavedServer } from './serverEndpoint';
import { clearServer, loadServer, saveServer } from './serverStore';
import './server-gate.css';

function stayOnPicker(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('picker') === '1' || params.get('shell') === '1' || params.get('error')) return true;
  return !Capacitor.isNativePlatform();
}

export default function ServerGate(): ReactElement {
  const [ready, setReady] = useState<boolean>(false);
  const [host, setHost] = useState<string>('');
  const [port, setPort] = useState<string>('');
  const [saved, setSaved] = useState<SavedServer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'unreachable') {
      setError('That server did not answer. Check the IP, the port, and that this phone is on the same network.');
    }
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: '#FDFDF9' }).catch(() => undefined);
    }
    let cancelled = false;
    void (async () => {
      const stored = await loadServer();
      if (cancelled) return;
      if (stored && !stayOnPicker()) {
        window.location.replace(serverUrl(stored.host, stored.port));
        return;
      }
      setSaved(stored);
      setHost(stored?.host ?? '');
      setPort(stored?.port ?? '');
      setReady(true);
      void SplashScreen.hide().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const problem = validateServer(host, port);
    if (problem) {
      setError(problem);
      return;
    }
    const next = { host: host.trim(), port: port.trim() };
    await saveServer(next);
    setSaved(next);
    setError(null);
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    const picker = `${window.location.pathname}?picker=1`;
    window.history.replaceState(null, '', picker);
    window.location.assign(serverUrl(next.host, next.port));
  }

  async function forget(): Promise<void> {
    await clearServer();
    setSaved(null);
    setHost('');
    setPort('');
    setError(null);
  }

  if (!ready) {
    return (
      <main className="gate">
        <div className="gate-opening">
          <LogoMark />
          <p>Opening your hub…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gate">
      <section className="gate-card" aria-labelledby="gate-title">
        <div className="gate-brand">
          <LogoMark />
          <b>ComForce <span>MKE</span></b>
        </div>
        <h1 id="gate-title">Connect to a <em>server.</em></h1>
        <p className="gate-lead">
          Type the address of the ComForce hub you want this phone to open. It stays on the device for the next demo.
        </p>
        <form onSubmit={(event) => void onSubmit(event)}>
          {error && <p className="gate-error" role="alert">{error}</p>}
          {saved && (
            <p className="gate-saved">
              Saved on this device: <b>{saved.host}:{saved.port}</b>
            </p>
          )}
          <label>
            IP address
            <input
              name="host"
              inputMode="decimal"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="192.168.1.20"
              value={host}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setHost(event.target.value)}
            />
          </label>
          <label>
            Port
            <input
              name="port"
              inputMode="numeric"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="3000"
              maxLength={5}
              value={port}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setPort(event.target.value)}
            />
          </label>
          <div className="gate-actions">
            <button type="submit" className="btn primary block">Save and open</button>
            {saved && (
              <button type="button" className="btn ghost gate-forget" onClick={() => void forget()}>
                Forget this server
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
