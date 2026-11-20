import { useState } from "react";
import { CityMap, when } from "./bits";
import { Icon } from "./icons";
import { go } from "./route";
import { useQuery } from "./shell";
import { useHubs } from "./store";

export function HomePage() {
  const { board, people } = useHubs();
  const { query } = useQuery();
  if (!board) return <p className="empty">Opening hubs…</p>;
  const needle = query.trim().toLowerCase();
  const joined = board.hubs.filter((hub) => hub.joined);
  const live = board.threads.find((thread) => thread.id === "missing-live");
  const recent = board.threads
    .filter((thread) => !thread.held && !thread.pinned)
    .filter((thread) => !needle || `${thread.title} ${thread.body}`.toLowerCase().includes(needle))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 5);

  return (
    <main className="dpage">
      <div className="greet">
        <h1>Good evening. <em>What do you need?</em></h1>
        <p>Your hubs are the forums. Open one to talk, or start from the live search if you can walk a block.</p>
      </div>
      {live && (
        <article className="alert">
          <Icon name="search" />
          <div>
            <h2>{live.title}</h2>
            <p>{live.body}</p>
          </div>
          <button type="button" className="btn primary" onClick={() => go(`/hubs/missing/${live.id}`)}>Open the search</button>
        </article>
      )}
      <div className="mod" style={{ marginBottom: 24 }}>
        <div className="mod-h">
          <h2>Your hubs</h2>
          <span className="count">{joined.length} joined</span>
          <button type="button" className="more" onClick={() => go("/hubs")}>Explore all 8</button>
        </div>
        <div className="mod-b">
          <div className="mini-hubs">
            {joined.map((hub) => (
              <button key={hub.id} type="button" className="ht" onClick={() => go(`/hubs/${hub.id}`)}>
                <span className="sw" style={{ background: hub.color }}><Icon name={hub.icon} /></span>
                <b>{hub.name}</b>
                <small>{hub.fact}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
      <article className="mod">
        <div className="mod-h"><h2>New in your hubs</h2></div>
        {recent.map((thread) => {
          const hub = board.hubs.find((row) => row.id === thread.hub_id);
          const author = people.get(thread.author_id);
          return (
            <button key={thread.id} type="button" className="bc" onClick={() => go(`/hubs/${thread.hub_id}/${thread.id}`)} style={{ width: "100%", background: "none", textAlign: "left" }}>
              <span className="sq" style={{ background: hub?.color ?? "var(--green)", color: "#fff" }}><Icon name={hub?.icon ?? "msg"} /></span>
              <div>
                <span className="stats">{hub?.name} · {author?.name} · {when(thread.created_at)}</span>
                <b style={{ display: "block" }}>{thread.title}</b>
                <p>{thread.body}</p>
              </div>
            </button>
          );
        })}
      </article>
    </main>
  );
}

export function MapPage() {
  const { board } = useHubs();
  const { query } = useQuery();
  const [hubId, setHubId] = useState<string>("all");
  if (!board) return <p className="empty">Opening hubs…</p>;
  const needle = query.trim().toLowerCase();
  const places = board.places.filter((place) => {
    if (hubId !== "all" && place.hub_id !== hubId) return false;
    return !needle || `${place.name} ${place.detail}`.toLowerCase().includes(needle);
  });
  return (
    <main className="dpage">
      <div className="pagehead">
        <div>
          <h1>Map</h1>
          <p>Places neighbors posted inside hubs. This is a schematic, so you can see what is open before a full street map is wired up.</p>
        </div>
      </div>
      <div className="seg" role="group" aria-label="Hub" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={hubId === "all"} onClick={() => setHubId("all")}>All hubs</button>
        {board.hubs.map((hub) => (
          <button key={hub.id} type="button" aria-pressed={hubId === hub.id} onClick={() => setHubId(hub.id)}>{hub.name.split("·")[0].trim()}</button>
        ))}
      </div>
      <div className="g12">
        <article className="mod">
          <CityMap places={places} color="#0F6B3A" />
        </article>
        <article className="mod">
          <div className="mod-h"><h2>{places.length} places</h2></div>
          <div className="mod-b">
            {places.map((place) => {
              const hub = board.hubs.find((row) => row.id === place.hub_id);
              return (
                <button key={place.id} type="button" className="pantry" onClick={() => go(`/hubs/${place.hub_id}`)} style={{ width: "100%", background: "none", textAlign: "left" }}>
                  <b>{place.name}</b>
                  <span className={place.open ? "open" : "open closed"}>{place.status}</span>
                  <p>{hub?.name}. {place.detail}</p>
                </button>
              );
            })}
          </div>
        </article>
      </div>
    </main>
  );
}

export function RequestsPage() {
  const { board, me, claim } = useHubs();
  const { query } = useQuery();
  const [filter, setFilter] = useState<"all" | "urgent" | "mine">("all");
  if (!board || !me) return <p className="empty">Opening hubs…</p>;
  const needle = query.trim().toLowerCase();
  const rows = board.requests.filter((row) => {
    if (filter === "urgent" && row.urgency !== "Urgent") return false;
    if (filter === "mine" && row.claimed_by !== me.id) return false;
    return !needle || row.title.toLowerCase().includes(needle);
  });
  return (
    <main className="dpage">
      <div className="pagehead">
        <div>
          <h1>Requests</h1>
          <p>One list, from every hub. Take one if you can do it. The person who asked is not named here.</p>
        </div>
        <div className="right">
          <div className="seg" role="group" aria-label="Show">
            {(
              [
                ["all", "All"],
                ["urgent", "Urgent"],
                ["mine", "My requests"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <article className="mod">
        <div className="mod-b">
          {rows.length === 0 && <p className="empty">Nothing in this list.</p>}
          {rows.map((row) => {
            const hub = board.hubs.find((item) => item.id === row.hub_id);
            return (
              <article key={row.id} className="req">
                <div className="req-main">
                  <div className="req-meta">
                    <span className={`tag ${row.urgency === "Urgent" ? "urgent" : row.urgency === "Today" ? "today" : "week"}`}>{row.urgency}</span>
                    <button type="button" onClick={() => go(`/hubs/${row.hub_id}`)} style={{ background: "none", border: 0, padding: 0, color: "var(--green)", fontWeight: 700 }}>
                      {hub?.name}
                    </button>
                    <span>{row.distance}</span>
                  </div>
                  <h3>{row.title}</h3>
                  {row.why && <p className="why"><Icon name="spark" size={15} />{row.why}</p>}
                </div>
                <button type="button" className="take" disabled={Boolean(row.claimed_by)} onClick={() => void claim(row.id)}>
                  <Icon name="hand" />
                  <span>{row.claimed_by === me.id ? "Taken by you" : row.claimed_by ? "Taken" : "Take it"}</span>
                  <small>#{row.id}</small>
                </button>
              </article>
            );
          })}
        </div>
      </article>
    </main>
  );
}
