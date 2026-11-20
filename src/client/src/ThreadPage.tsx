import { useState } from "react";
import { Byline, Flair, Vote, when } from "./bits";
import { Icon } from "./icons";
import { go } from "./route";
import { useHubs } from "./store";
import type { Reply } from "./types";

export function ThreadPage({ hubId, threadId }: { hubId: string; threadId: string }) {
  const { board, people, me, staff, reply, toggleHelpful } = useHubs();
  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hub = board?.hubs.find((row) => row.id === hubId);
  const thread = board?.threads.find((row) => row.id === threadId && row.hub_id === hubId);

  if (!board || !me) return <p className="empty">Opening hubs…</p>;
  if (!hub || !thread) {
    return (
      <main className="dpage">
        <p className="empty">That thread is not in this hub.</p>
        <button type="button" className="btn" onClick={() => go(`/hubs/${hubId}`)}>Back to the hub</button>
      </main>
    );
  }

  const author = people.get(thread.author_id);
  const replies = board.replies
    .filter((row) => row.thread_id === thread.id)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const parent = replies.find((row) => row.id === parentId);

  async function send() {
    if (!body.trim()) {
      setError("Write a reply first.");
      return;
    }
    try {
      await reply(thread!.id, body, parentId);
      setBody("");
      setParentId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That reply did not post");
    }
  }

  return (
    <main className="dpage">
      <div className="backline">
        <button type="button" onClick={() => go("/hubs")}>Hubs</button>
        <span>/</span>
        <button type="button" onClick={() => go(`/hubs/${hub.id}`)}>{hub.name}</button>
      </div>
      <article className="mod" style={{ marginTop: 16 }}>
        <div className={thread.pinned ? "post pinned thread-hero" : "post thread-hero"}>
          <Vote pressed={thread.helpful_by_me} count={thread.helpful} onClick={() => void toggleHelpful("thread", thread.id)} />
          <div className="thread">
            {author && <Byline person={author} when={thread.pinned ? "pinned" : when(thread.created_at)} />}
            <h1>{thread.title}</h1>
            {thread.flair && <div style={{ marginTop: 10 }}><Flair name={thread.flair} /></div>}
            {thread.held && thread.author_id !== me.id && !staff ? (
              <p>This post is held. The wording stays with the author and with staff until the private detail is gone.</p>
            ) : thread.steps ? (
              <ol>{thread.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            ) : (
              <p>{thread.body}</p>
            )}
            {thread.held && thread.held_reason && (thread.author_id === me.id || staff) && (
              <div className="held" style={{ marginTop: 12 }}>
                <Icon name="lock" />
                <span>{thread.held_reason} It is not in the public list.</span>
              </div>
            )}
            {thread.ai_answer && (
              <div className="answer">
                <Icon name="spark" size={15} />
                <span><b>Answered automatically. </b>{thread.ai_answer}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mod-b">
          <h2 style={{ fontSize: 18 }}>{replies.length} {replies.length === 1 ? "reply" : "replies"}</h2>
          {replies.map((row) => (
            <ReplyRow key={row.id} row={row} onHelpful={() => void toggleHelpful("reply", row.id)} onReply={() => setParentId(row.id)} />
          ))}
          <div className="replybox">
            {parent && (
              <div className="replying">
                <span>Replying to {people.get(parent.author_id)?.name}</span>
                <button type="button" onClick={() => setParentId(null)}>Cancel</button>
              </div>
            )}
            <label className="field" style={{ marginTop: 0 }}>
              <span>Reply as {me.name}</span>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Keep addresses and phone numbers off the thread." />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="button" className="btn primary" onClick={() => void send()}>Reply</button>
          </div>
        </div>
      </article>
    </main>
  );
}

function ReplyRow({ row, onHelpful, onReply }: { row: Reply; onHelpful: () => void; onReply: () => void }) {
  const { people } = useHubs();
  const person = people.get(row.author_id);
  if (!person) return null;
  return (
    <div className={row.parent_id ? "reply child" : "reply"}>
      <div className="post" style={{ borderTop: 0, paddingLeft: 0 }}>
        <Vote pressed={row.helpful_by_me} count={row.helpful} onClick={onHelpful} />
        <div>
          <Byline person={person} when={when(row.created_at)} />
          <p style={{ marginTop: 6 }}>{row.body}</p>
          <div className="acts">
            <button type="button" onClick={onReply}>Reply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
