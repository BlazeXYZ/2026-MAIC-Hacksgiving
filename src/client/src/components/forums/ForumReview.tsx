import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { forumErrorMessage, listHeld, reviewHeld } from '../../api/forums';
import type { ForumHubId, HeldPost, ReviewAction } from '../../contracts/forums';
import { Icon } from '../ui/Icon';
import { timeAgo } from './util';
import './forums.css';

const HUB_NAMES: Record<ForumHubId, string> = {
  'domestic-safety': 'Domestic Abuse Support',
  'missing-persons': 'Missing Persons',
  'food-pantry': 'Food Pantry',
};

/** Coordinator queue of held forum posts: publish (contact details scrubbed) or remove. */
export default function ForumReview({ accessKey }: { accessKey: string }): ReactElement {
  const [rows, setRows] = useState<HeldPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setRows(await listHeld(accessKey));
      setError(null);
    } catch (err) {
      setError(forumErrorMessage(err, 'Held posts did not load. Try again.'));
    }
  }, [accessKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function settled(id: string, message: string): void {
    setRows((prev) => (prev ? prev.filter((row) => row.id !== id) : prev));
    setDone(message);
  }

  return (
    <section className="mod forum-review" aria-labelledby="forum-review-title">
      <div className="mod-h">
        <h2 id="forum-review-title">Held forum posts</h2>
        <button type="button" className="more" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <p className="mod-sub">
        These posts had an address, phone number, or email, or wording the abuse check flagged. Publishing replaces
        contact details with a redaction note. Edit the text first if it gives away a home some other way.
      </p>
      <div className="mod-b">
        {done && (
          <p className="forum-notice ok" role="status">
            <Icon name="check" />
            <span>{done}</span>
          </p>
        )}
        {error && !rows ? (
          <p className="forum-error" role="alert">
            {error}
          </p>
        ) : !rows ? (
          <p className="meta">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="meta forum-empty">Nothing is held right now.</p>
        ) : (
          <ul className="forum-held-list">
            {rows.map((row) => (
              <HeldCard key={row.id} row={row} accessKey={accessKey} onSettled={settled} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function HeldCard({
  row,
  accessKey,
  onSettled,
}: {
  row: HeldPost;
  accessKey: string;
  onSettled: (id: string, message: string) => void;
}): ReactElement {
  const [text, setText] = useState(row.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: ReviewAction): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const edited = action === 'publish' && text.trim() !== row.body.trim() ? text : undefined;
      await reviewHeld(accessKey, row.id, action, edited);
      onSettled(row.id, action === 'publish' ? `Published the post by ${row.author}.` : `Removed the post by ${row.author}.`);
    } catch (err) {
      setError(forumErrorMessage(err, 'That did not go through. Try again.'));
      setBusy(false);
    }
  }

  return (
    <li className="forum-held-card">
      <div className="top">
        <span className="tag held">{row.kind === 'thread' ? 'New thread' : 'Reply'}</span>
        <b>{HUB_NAMES[row.hub_id]}</b>
        <span className="meta">
          · {row.author} · {timeAgo(row.created_at)}
        </span>
      </div>
      <h3>{row.kind === 'thread' ? row.title : `On "${row.thread_title}"`}</h3>
      <p className="forum-held-reason">
        <Icon name="lock" />
        {row.held_reason}
      </p>
      <label htmlFor={`held-${row.id}`}>Text to publish</label>
      <textarea id={`held-${row.id}`} value={text} rows={3} maxLength={2000} onChange={(e) => setText(e.target.value)} />
      {error && (
        <p className="forum-error" role="alert">
          {error}
        </p>
      )}
      <div className="forum-actions">
        <button type="button" className="btn primary sm" disabled={busy} onClick={() => void act('publish')}>
          Publish, scrubbed
        </button>
        <button type="button" className="btn danger sm" disabled={busy} onClick={() => void act('remove')}>
          Remove
        </button>
      </div>
    </li>
  );
}
