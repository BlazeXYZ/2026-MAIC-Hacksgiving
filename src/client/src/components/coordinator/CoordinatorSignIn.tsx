import { useState, type FormEvent } from 'react';
import { verifyCoordinatorKey } from '../../coordinator/access';
import './CoordinatorSignIn.css';

const MESSAGES = {
  denied: 'That access key was not accepted.',
  unreachable: 'Could not reach the server. Try again in a moment.',
} as const;

/** Staff-only gate in front of the coordinator queue and ops map. */
export default function CoordinatorSignIn({ onSignIn }: { onSignIn: (accessKey: string) => void }) {
  const [accessKey, setAccessKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = accessKey.trim();
    if (!key) return;
    setChecking(true);
    setError('');
    const result = await verifyCoordinatorKey(key);
    setChecking(false);
    if (result === 'ok') {
      setAccessKey('');
      onSignIn(key);
    } else {
      setError(MESSAGES[result]);
    }
  }

  return (
    <section className="coordinator-sign-in" aria-labelledby="coordinator-sign-in-title">
      <h2 id="coordinator-sign-in-title">Staff sign in</h2>
      <p>The dispatch queue and ops map are for ComForce coordinators only.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="coordinator-access-key">Coordinator access key</label>
        <input
          id="coordinator-access-key"
          type="password"
          autoComplete="off"
          value={accessKey}
          onChange={(event) => setAccessKey(event.target.value)}
          aria-describedby={error ? 'coordinator-sign-in-error' : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
        <button type="submit" disabled={checking || !accessKey.trim()}>
          {checking ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      <p id="coordinator-sign-in-error" role="alert" className="coordinator-sign-in-error">{error}</p>
    </section>
  );
}
