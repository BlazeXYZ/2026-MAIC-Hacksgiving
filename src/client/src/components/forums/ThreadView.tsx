import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { createReply, forumErrorMessage, getThread } from '../../api/forums';
import type { ReplyView, ThreadDetail } from '../../contracts/forums';
import { Icon } from '../ui/Icon';
import { byline, replyTree, timeAgo } from './util';
import type { ReplyNode } from './util';

interface Props {
  threadId: string;
  handle: string | null;
  onHandle: (handle: string) => void;
  coordinatorKey: string | null;
  marked: ReadonlySet<string>;
  onHelpful: (kind: 'thread' | 'reply', id: string) => Promise<number | null>;
  onBack: () => void;
}

/** One thread with its replies, reply-to-a-reply, and Helpful marks. */
export default function ThreadView({
  threadId,
  handle,
  onHandle,
  coordinatorKey,
  marked,
  onHelpful,
  onBack,
}: Props): ReactElement {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyView | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setThread(await getThread(threadId));
      setError(null);
    } catch (err) {
      setError(forumErrorMessage(err, 'This thread did not load. Try again.'));
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function helpful(kind: 'thread' | 'reply', id: string): Promise<void> {
    const count = await onHelpful(kind, id);
    if (count === null) return;
    setThread((prev) => {
      if (!prev) return prev;
      if (kind === 'thread') return { ...prev, helpful: count };
      return { ...prev, replies: prev.replies.map((r) => (r.id === id ? { ...r, helpful: count } : r)) };
    });
  }

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft.trim()) {
      setSendError('Write a reply first.');
      return;
    }
    setSending(true);
    setSendError(null);
    setHeld(null);
    try {
      const posted = await createReply(threadId, draft.trim(), replyTo?.id ?? null, handle, coordinatorKey);
      if (!coordinatorKey) onHandle(posted.handle);
      setDraft('');
      setReplyTo(null);
      if (posted.status === 'held') {
        setHeld(`We held your reply. ${posted.held_reason ?? ''}`);
      } else {
        await load();
      }
    } catch (err) {
      setSendError(forumErrorMessage(err, 'That reply did not post. Try again.'));
    } finally {
      setSending(false);
    }
  }

  const back = (
    <button type="button" className="btn ghost sm forum-back" onClick={onBack}>
      <Icon name="chev" className="ic forum-back-ic" />
      All threads
    </button>
  );

  if (!thread) {
    return (
      <div className="forum">
        {back}
        {error ? (
          <p className="forum-error" role="alert">
            {error}{' '}
            <button type="button" className="btn sm" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : (
          <p className="meta forum-empty">Loading thread…</p>
        )}
      </div>
    );
  }

  const tree = replyTree(thread.replies);

  return (
    <div className="forum">
      {back}
      <article className={`thread open${thread.pinned ? ' pinned' : ''}`} aria-labelledby="forum-thread-title">
        <div className="top">
          <b>{byline(thread.author, thread.role)}</b>
          <span>· {timeAgo(thread.created_at)}</span>
          {thread.flair && <span className={`forum-flair ${thread.flair.toLowerCase()}`}>{thread.flair}</span>}
        </div>
        <h3 id="forum-thread-title">{thread.title}</h3>
        <p>{thread.body}</p>
        {thread.steps && (
          <ol>
            {thread.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
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
          <button type="button" aria-pressed={marked.has(`thread:${thread.id}`)} onClick={() => void helpful('thread', thread.id)}>
            Helpful · {thread.helpful}
          </button>
        </div>
      </article>

      <h4 className="forum-count">
        {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
      </h4>
      {tree.length > 0 && (
        <ul className="forum-replies">
          {tree.map((node) => (
            <ReplyItem
              key={node.reply.id}
              node={node}
              marked={marked}
              onReply={setReplyTo}
              onHelpful={(id) => void helpful('reply', id)}
            />
          ))}
        </ul>
      )}

      {held && (
        <p className="forum-notice held" role="status">
          <Icon name="lock" />
          <span>{held}</span>
        </p>
      )}

      <form className="forum-compose" onSubmit={(e) => void send(e)}>
        {replyTo && (
          <p className="forum-replying">
            Replying to <b>{replyTo.author}</b>
            <button type="button" className="btn ghost sm" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </p>
        )}
        <label htmlFor="forum-reply">Your reply</label>
        <textarea
          id="forum-reply"
          value={draft}
          maxLength={1000}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Corners and times only, never a house number."
        />
        {sendError && (
          <p className="forum-error" role="alert">
            {sendError}
          </p>
        )}
        <div className="forum-actions">
          <button type="submit" className="btn primary sm" disabled={sending}>
            {sending ? 'Posting…' : 'Reply'}
          </button>
          <span className="meta">
            {coordinatorKey ? 'Posting as ComForce coordinator.' : `You post as ${handle ?? 'a pseudonym'}.`}
          </span>
        </div>
      </form>
    </div>
  );
}

function ReplyItem({
  node,
  marked,
  onReply,
  onHelpful,
}: {
  node: ReplyNode;
  marked: ReadonlySet<string>;
  onReply: (reply: ReplyView) => void;
  onHelpful: (id: string) => void;
}): ReactElement {
  const { reply, children } = node;
  return (
    <li className="forum-reply">
      <div className="top">
        <b>{byline(reply.author, reply.role)}</b>
        <span>· {timeAgo(reply.created_at)}</span>
      </div>
      <p>{reply.body}</p>
      <div className="acts">
        <button type="button" onClick={() => onReply(reply)}>
          Reply
        </button>
        <button type="button" aria-pressed={marked.has(`reply:${reply.id}`)} onClick={() => onHelpful(reply.id)}>
          Helpful · {reply.helpful}
        </button>
      </div>
      {children.length > 0 && (
        <ul className="forum-replies nested">
          {children.map((child) => (
            <ReplyItem key={child.reply.id} node={child} marked={marked} onReply={onReply} onHelpful={onHelpful} />
          ))}
        </ul>
      )}
    </li>
  );
}
