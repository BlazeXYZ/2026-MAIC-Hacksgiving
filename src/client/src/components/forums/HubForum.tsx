import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { createThread, forumErrorMessage, listThreads, markHelpful } from '../../api/forums';
import type { ForumHubId, ThreadList, ThreadSort, ThreadSummary } from '../../contracts/forums';
import { Icon } from '../ui/Icon';
import ThreadView from './ThreadView';
import { byline, timeAgo } from './util';
import './forums.css';

interface Props {
  hubId: ForumHubId;
  members: number;
  /** Pseudonym from an earlier post this session, held in memory only. */
  handle: string | null;
  onHandle: (handle: string) => void;
  /** Staff posts go up as ComForce coordinator. */
  coordinatorKey: string | null;
}

type Notice = { tone: 'ok' | 'held'; text: string } | null;

const SORTS: { id: ThreadSort; label: string }[] = [
  { id: 'hot', label: 'Hot' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
];

/** The Threads tab of a hub: pinned welcome steps, a thread list, and a composer. */
export default function HubForum({ hubId, members, handle, onHandle, coordinatorKey }: Props): ReactElement {
  const [sort, setSort] = useState<ThreadSort>('hot');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<ThreadList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  // Which posts this visitor marked helpful. Memory only, like the pseudonym.
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async (): Promise<void> => {
    try {
      setList(await listThreads(hubId, sort, query));
      setLoadError(null);
    } catch (err) {
      setLoadError(forumErrorMessage(err, 'The threads did not load. Check your connection and try again.'));
    }
  }, [hubId, sort, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  async function toggleHelpful(kind: 'thread' | 'reply', id: string): Promise<number | null> {
    const key = `${kind}:${id}`;
    const on = !marked.has(key);
    try {
      const { helpful } = await markHelpful(kind, id, on);
      setMarked((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
      if (kind === 'thread') {
        setList((prev) =>
          prev ? { ...prev, threads: prev.threads.map((t) => (t.id === id ? { ...t, helpful } : t)) } : prev,
        );
      }
      return helpful;
    } catch {
      return null;
    }
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (title.trim().length < 3 || !body.trim()) {
      setPostError('Add a title and say what you want neighbors to know.');
      return;
    }
    setPosting(true);
    setPostError(null);
    try {
      const posted = await createThread(hubId, title.trim(), body.trim(), handle, coordinatorKey);
      if (!coordinatorKey) onHandle(posted.handle);
      setTitle('');
      setBody('');
      setComposing(false);
      if (posted.status === 'held') {
        setNotice({
          tone: 'held',
          text: `We held "${posted.thread.title}". ${posted.held_reason ?? ''} It is not on the public list.`,
        });
      } else {
        setNotice({ tone: 'ok', text: `Posted as ${posted.thread.author}.` });
      }
      await load();
    } catch (err) {
      setPostError(forumErrorMessage(err, 'That did not post. Try again in a moment.'));
    } finally {
      setPosting(false);
    }
  }

  if (openId) {
    return (
      <ThreadView
        threadId={openId}
        handle={handle}
        onHandle={onHandle}
        coordinatorKey={coordinatorKey}
        marked={marked}
        onHelpful={toggleHelpful}
        onBack={() => {
          setOpenId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="forum">
      {notice && (
        <p className={`forum-notice ${notice.tone}`} role="status">
          <Icon name={notice.tone === 'held' ? 'lock' : 'check'} />
          <span>{notice.text}</span>
          <button type="button" className="btn ghost sm" onClick={() => setNotice(null)} aria-label="Dismiss">
            <Icon name="x" />
          </button>
        </p>
      )}

      {composing ? (
        <form className="forum-compose" onSubmit={(e) => void submit(e)}>
          <label htmlFor={`forum-title-${hubId}`}>Title</label>
          <input
            id={`forum-title-${hubId}`}
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to ask or share?"
          />
          <label htmlFor={`forum-body-${hubId}`}>Message</label>
          <textarea
            id={`forum-body-${hubId}`}
            value={body}
            maxLength={2000}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a corner or a time, never a house number."
          />
          <p className="meta forum-privacy">
            <Icon name="lock" />
            {coordinatorKey
              ? 'Posting as ComForce coordinator.'
              : `You post as ${handle ?? 'a pseudonym'}, never your name. Posts with an address, phone number, or email are held for a coordinator.`}
          </p>
          {postError && (
            <p className="forum-error" role="alert">
              {postError}
            </p>
          )}
          <div className="forum-actions">
            <button type="submit" className="btn primary sm" disabled={posting}>
              {posting ? 'Posting…' : 'Post'}
            </button>
            <button type="button" className="btn sm" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="forum-start" onClick={() => setComposing(true)}>
          <Icon name="plus" />
          <span>Ask a question or share something with {members} neighbors…</span>
        </button>
      )}

      {list && list.held_count > 0 && (
        <p className="forum-held">
          <Icon name="lock" />
          {list.held_count === 1 ? '1 post is' : `${list.held_count} posts are`} held for review because of private
          details. A coordinator will check {list.held_count === 1 ? 'it' : 'them'}.
        </p>
      )}

      <div className="forum-tools">
        <div className="seg" role="group" aria-label="Sort threads">
          {SORTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <input
          className="forum-search"
          type="search"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this hub"
          aria-label="Search this hub"
        />
      </div>

      {loadError && !list ? (
        <p className="forum-error" role="alert">
          {loadError}{' '}
          <button type="button" className="btn sm" onClick={() => void load()}>
            Try again
          </button>
        </p>
      ) : !list ? (
        <p className="meta forum-empty">Loading threads…</p>
      ) : list.threads.length === 0 ? (
        <p className="meta forum-empty">{query ? 'No threads match that search.' : 'No threads yet. Start one.'}</p>
      ) : (
        <ul className="forum-rows">
          {list.threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              marked={marked.has(`thread:${thread.id}`)}
              onOpen={() => setOpenId(thread.id)}
              onHelpful={() => void toggleHelpful('thread', thread.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ThreadRow({
  thread,
  marked,
  onOpen,
  onHelpful,
}: {
  thread: ThreadSummary;
  marked: boolean;
  onOpen: () => void;
  onHelpful: () => void;
}): ReactElement {
  return (
    <li className={`thread${thread.pinned ? ' pinned' : ''}`}>
      <div className="top">
        {thread.pinned && <Icon name="pin" />}
        <b>{byline(thread.author, thread.role)}</b>
        <span>· {thread.pinned ? 'pinned' : timeAgo(thread.created_at)}</span>
        {thread.flair && <span className={`forum-flair ${thread.flair.toLowerCase()}`}>{thread.flair}</span>}
      </div>
      <h3>
        <button type="button" className="forum-title" onClick={onOpen}>
          {thread.title}
        </button>
      </h3>
      {thread.steps ? (
        <>
          <p>{thread.body}</p>
          <ol>
            {thread.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      ) : (
        <p className="forum-clip">{thread.body}</p>
      )}
      {thread.answer && (
        <div className="answer">
          <Icon name="spark" />
          <span>
            <b>Answered automatically:</b> {thread.answer}
          </span>
        </div>
      )}
      <div className="acts">
        <button type="button" onClick={onOpen}>
          {thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
        </button>
        <button type="button" aria-pressed={marked} onClick={onHelpful}>
          Helpful · {thread.helpful}
        </button>
      </div>
    </li>
  );
}
