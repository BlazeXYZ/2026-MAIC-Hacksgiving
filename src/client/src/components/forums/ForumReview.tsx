import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import {
  forumErrorMessage,
  listCases,
  listHeld,
  listPrivateTips,
  openCase,
  resolveCase,
  reviewHeld,
} from '../../api/forums';
import type { ForumHubId, HeldPost, MissingPersonCase, PrivateTip, ReviewAction } from '../../contracts/forums';
import { Icon } from '../ui/Icon';
import { timeAgo } from './util';
import './forums.css';

const HUB_NAMES: Record<ForumHubId, string> = {
  'domestic-safety': 'Domestic Abuse Support',
  'missing-persons': 'Missing Persons',
  'food-pantry': 'Food Pantry',
};

const DONE_MESSAGE: Record<ReviewAction, (author: string) => string> = {
  publish: (author) => `Published the post by ${author}.`,
  keep_private: (author) => `Kept the tip from ${author} private. Only coordinators can see it.`,
  remove: (author) => `Removed the post by ${author}.`,
};

/**
 * Coordinator queue of held forum posts: publish (contact details scrubbed) or remove.
 * Tips on a missing-person lead thread are always held here, and can also be kept private.
 */
export default function ForumReview({ accessKey }: { accessKey: string }): ReactElement {
  const [rows, setRows] = useState<HeldPost[] | null>(null);
  const [privateTips, setPrivateTips] = useState<PrivateTip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [held, kept] = await Promise.all([listHeld(accessKey), listPrivateTips(accessKey)]);
      setRows(held);
      setPrivateTips(kept);
      setError(null);
    } catch (err) {
      setError(forumErrorMessage(err, 'Held posts did not load. Try again.'));
    }
  }, [accessKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function settled(id: string, message: string, action: ReviewAction): void {
    setRows((prev) => (prev ? prev.filter((row) => row.id !== id) : prev));
    setDone(message);
    if (action === 'keep_private') void listPrivateTips(accessKey).then(setPrivateTips).catch(() => undefined);
  }

  return (
    <>
      <section className="mod forum-review" aria-labelledby="forum-review-title">
        <div className="mod-h">
          <h2 id="forum-review-title">Held forum posts</h2>
          <button type="button" className="more" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        <p className="mod-sub">
          These posts had an address, phone number, or email, or wording the abuse check flagged. Every tip on a
          missing-person lead thread is held too. Publishing replaces contact details with a redaction note. Edit the
          text first if it gives away a home some other way.
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

      <section className="mod forum-review" aria-labelledby="forum-private-title">
        <div className="mod-h">
          <h2 id="forum-private-title">Private tips</h2>
        </div>
        <p className="mod-sub">
          Lead tips kept off the thread, for example ones passed to police. Only coordinators see these.
        </p>
        <div className="mod-b">
          {privateTips.length === 0 ? (
            <p className="meta forum-empty">No private tips.</p>
          ) : (
            <ul className="forum-held-list">
              {privateTips.map((tip) => (
                <li key={tip.id} className="forum-held-card">
                  <div className="top">
                    <span className="tag held">Private tip</span>
                    {tip.sector && <span className="forum-flair">Sector {tip.sector}</span>}
                    <span className="meta">
                      · {tip.author} · {timeAgo(tip.created_at)}
                    </span>
                  </div>
                  <h3>On &ldquo;{tip.thread_title}&rdquo;</h3>
                  <p>{tip.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CasePanel accessKey={accessKey} />
    </>
  );
}

function HeldCard({
  row,
  accessKey,
  onSettled,
}: {
  row: HeldPost;
  accessKey: string;
  onSettled: (id: string, message: string, action: ReviewAction) => void;
}): ReactElement {
  const [text, setText] = useState(row.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTip = Boolean(row.case_id);

  async function act(action: ReviewAction): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const edited = action !== 'remove' && text.trim() !== row.body.trim() ? text : undefined;
      await reviewHeld(accessKey, row.id, action, edited);
      onSettled(row.id, DONE_MESSAGE[action](row.author), action);
    } catch (err) {
      setError(forumErrorMessage(err, 'That did not go through. Try again.'));
      setBusy(false);
    }
  }

  return (
    <li className="forum-held-card">
      <div className="top">
        <span className="tag held">{isTip ? 'Lead tip' : row.kind === 'thread' ? 'New thread' : 'Reply'}</span>
        <b>{HUB_NAMES[row.hub_id]}</b>
        {row.sector && <span className="forum-flair">Sector {row.sector}</span>}
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
          {isTip ? 'Publish as verified' : 'Publish, scrubbed'}
        </button>
        {isTip && (
          <button type="button" className="btn sm" disabled={busy} onClick={() => void act('keep_private')}>
            Keep private
          </button>
        )}
        <button type="button" className="btn danger sm" disabled={busy} onClick={() => void act('remove')}>
          Remove
        </button>
      </div>
    </li>
  );
}

/** Open a missing-person case (creates its pinned lead thread) or close one (locks the thread). */
function CasePanel({ accessKey }: { accessKey: string }): ReactElement {
  const [cases, setCases] = useState<MissingPersonCase[] | null>(null);
  const [name, setName] = useState('');
  const [point, setPoint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setCases(await listCases());
    } catch (err) {
      setError(forumErrorMessage(err, 'Cases did not load. Try again.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (err) {
      setError(forumErrorMessage(err, 'That did not go through. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (!name.trim() || point.trim().length < 3) {
      setError('Add a display name (initials are fine) and a public last-known corner or landmark.');
      return;
    }
    void run(async () => {
      await openCase(accessKey, name.trim(), point.trim());
      setName('');
      setPoint('');
    });
  }

  return (
    <section className="mod forum-review" aria-labelledby="forum-cases-title">
      <div className="mod-h">
        <h2 id="forum-cases-title">Missing-person cases</h2>
      </div>
      <p className="mod-sub">
        Each active case has one pinned lead thread in the Missing Persons hub. Closing a case locks its thread.
      </p>
      <div className="mod-b">
        {error && (
          <p className="forum-error" role="alert">
            {error}
          </p>
        )}
        {!cases ? (
          <p className="meta">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="meta forum-empty">No cases.</p>
        ) : (
          <ul className="forum-held-list">
            {cases.map((c) => (
              <li key={c.id} className="forum-held-card">
                <div className="top">
                  <span className={c.status === 'active' ? 'forum-flair alert' : 'forum-flair'}>
                    {c.status === 'active' ? 'Active' : 'Resolved'}
                  </span>
                  <b>{c.display_name}</b>
                  <span className="meta">
                    · last known {c.last_known_point} · opened {timeAgo(c.created_at)}
                  </span>
                </div>
                {c.status === 'active' && (
                  <div className="forum-actions">
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busy}
                      onClick={() => void run(() => resolveCase(accessKey, c.id))}
                    >
                      Close case and lock thread
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="forum-compose" onSubmit={submit}>
          <label htmlFor="case-name">Display name or initials</label>
          <input id="case-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan, 19" />
          <label htmlFor="case-point">Last-known point (a public corner or landmark)</label>
          <input
            id="case-point"
            value={point}
            maxLength={120}
            onChange={(e) => setPoint(e.target.value)}
            placeholder="e.g. 27th & W Wisconsin Ave"
          />
          <div className="forum-actions">
            <button type="submit" className="btn primary sm" disabled={busy}>
              Open case
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
