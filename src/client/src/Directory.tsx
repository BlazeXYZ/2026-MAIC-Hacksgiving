import { useState } from "react";
import { Icon } from "./icons";
import { hubStats } from "./rules";
import { go } from "./route";
import { useQuery } from "./shell";
import { useHubs } from "./store";

export function Directory() {
  const { board, toggleJoin, suggest } = useHubs();
  const { query } = useQuery();
  const [filter, setFilter] = useState<"all" | "joined" | "suggested">("all");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!board) return <p className="empty">Opening hubs…</p>;

  const needle = query.trim().toLowerCase();
  const hubs = board.hubs.filter((hub) => {
    if (filter === "joined" && !hub.joined) return false;
    if (filter === "suggested" && !hub.suggested) return false;
    if (!needle) return true;
    const hay = `${hub.name} ${hub.summary} ${hub.chips.join(" ")}`.toLowerCase();
    return hay.includes(needle);
  });

  return (
    <main className="dpage">
      <div className="pagehead">
        <div>
          <h1>Hubs</h1>
          <p>Every ComForce program has a hub with the same basics (threads, a map, requests and news) plus tools of its own.</p>
        </div>
        <div className="right">
          <div className="seg" role="group" aria-label="Show">
            {(
              [
                ["all", "All 8"],
                ["joined", "Joined"],
                ["suggested", "Suggested"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {hubs.length === 0 ? (
        <p className="empty">No hubs match that.</p>
      ) : (
        <div className="dirgrid">
          {hubs.map((hub) => (
            <article key={hub.id} className="hubcard">
              <button type="button" className="band" style={{ backgroundColor: hub.color }} onClick={() => go(`/hubs/${hub.id}`)}>
                <span className="sw" style={{ background: hub.color }}>
                  <Icon name={hub.icon} />
                </span>
                {hub.flag && <span className={hub.flag_hot ? "flag2 hot" : "flag2"}>{hub.flag}</span>}
              </button>
              <div className="body">
                <h3>
                  <button type="button" onClick={() => go(`/hubs/${hub.id}`)} style={{ background: "none", border: 0, padding: 0, font: "inherit", fontWeight: 700 }}>
                    {hub.name}
                  </button>
                </h3>
                <p>{hub.summary}</p>
                <span className="stats">{hubStats(hub)}</span>
                <div className="tools">
                  {hub.chips.map((chip) => (
                    <span key={chip} className="tag plain">{chip}</span>
                  ))}
                </div>
                <button
                  type="button"
                  className={hub.joined ? "btn sm joined" : "btn sm"}
                  onClick={() => void toggleJoin(hub.id)}
                >
                  {hub.joined && <Icon name="check" />}
                  {hub.joined ? "Joined" : "Join"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {board.suggestions.length > 0 && (
        <div className="mod" style={{ marginTop: 24 }}>
          <div className="mod-h"><h2>Sent to ComForce staff</h2></div>
          <div className="mod-b">
            {board.suggestions.map((idea) => (
              <div key={idea.id} className="pantry">
                <b>{idea.name}</b>
                <span className="open">With staff</span>
                <p>{idea.audience}. {idea.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="tip">
        <Icon name="lamp" />
        <span>
          <b>Want a hub for your block club, school or church?</b> ComForce staff set hubs up with a community partner.{" "}
          <button type="button" className="link" onClick={() => setOpen(true)}>Suggest one</button>
        </span>
      </div>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim() || !audience.trim() || !why.trim()) {
                setError("Say what the hub is, who it is for, and why.");
                return;
              }
              void suggest(name, audience, why).then(() => {
                setOpen(false);
                setName("");
                setAudience("");
                setWhy("");
                setError(null);
              });
            }}
          >
            <h2>Suggest a hub</h2>
            <p className="voice">Staff set it up with a community partner. Sending this does not publish a hub.</p>
            <div className="field">
              <label htmlFor="idea-name">Hub name</label>
              <input id="idea-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Walker’s Point block club" />
            </div>
            <div className="field">
              <label htmlFor="idea-who">Who it is for</label>
              <input id="idea-who" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Neighbors on our block" />
            </div>
            <div className="field">
              <label htmlFor="idea-why">Why it should exist</label>
              <textarea id="idea-why" value={why} onChange={(event) => setWhy(event.target.value)} placeholder="We already share a porch pantry and need one place to post." />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="held-actions" style={{ marginTop: 16 }}>
              <button type="submit" className="btn primary">Send to staff</button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
