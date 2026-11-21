import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { describeError, getAliases } from '../../api/inventory';

interface Props {
  /** Why the key is needed, in a sentence. */
  reason: string;
  onUnlock: (key: string) => void;
}

/** Asks for the coordinator key and checks it against the server before handing it back. It is never stored. */
export default function KeyPrompt({ reason, onUnlock }: Props): ReactElement {
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const key = draft.trim();
    if (!key || checking) return;
    setChecking(true);
    setError(null);
    try {
      await getAliases(key, 'seeded'); // any coordinator-only call proves the key
      setDraft('');
      onUnlock(key);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <form className="inv-keyprompt" onSubmit={(e) => void submit(e)}>
      <p>{reason}</p>
      <label className="inv-label" htmlFor="coordinator-key">
        Coordinator key
      </label>
      <input
        id="coordinator-key"
        className="inv-input"
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <p className="meta">The key stays in this tab&rsquo;s memory only. Closing the tab or using Quick Exit clears it.</p>
      {error && (
        <p className="inv-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={!draft.trim() || checking}>
        {checking ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  );
}
