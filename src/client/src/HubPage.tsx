import { useState } from "react";
import { Byline, CityMap, Flair, Vote, when } from "./bits";
import { Icon } from "./icons";
import { alertLabel, hotScore, hubStats } from "./rules";
import { go } from "./route";
import { useQuery } from "./shell";
import { useHubs } from "./store";
import type { HubTab, Thread } from "./types";

export function HubPage({ hubId }: { hubId: string }) {
  const { board, people, me, toggleJoin, cycleAlerts, toggleHelpful, createThread, claim, addToolItem, advanceItem, shareFood, openTrust } = useHubs();
  const { query } = useQuery();
  const [tab, setTab] = useState<HubTab>("threads");
  const [sort, setSort] = useState<"hot" | "new" | "top">("hot");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [heldNote, setHeldNote] = useState<string | null>(null);
  const [what, setWhat] = useState("");
  const [whenText, setWhenText] = useState("");
  const [postingAs, setPostingAs] = useState("Resident");
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [offer, setOffer] = useState("");

  const hub = board?.hubs.find((row) => row.id === hubId);
  if (!board || !me) return <p className="empty">Opening hubs…</p>;
  if (!hub) {
    return (
      <main className="dpage">
        <p className="empty">That hub is not on the list.</p>
        <button type="button" className="btn" onClick={() => go("/hubs")}>Back to hubs</button>
      </main>
    );
  }

  const activeId = hub.id;
  const tool = board.tools.find((row) => row.id === hub.own_tool_id);
  const needle = query.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
  const threads = board.threads.filter((thread) => thread.hub_id === hub.id);
  const held = threads.filter((thread) => thread.held);
  const places = board.places.filter((place) => place.hub_id === hub.id && matches(`${place.name} ${place.detail}`));
  const requests = board.requests.filter((row) => row.hub_id === hub.id && matches(row.title));
  const news = board.news.filter((row) => row.hub_id === hub.id && matches(`${row.title} ${row.body}`));
  const visible = threads.filter((thread) => !thread.held && matches(`${thread.title} ${thread.body}`));
  const ordered = [
    ...visible.filter((thread) => thread.pinned),
    ...visible
      .filter((thread) => !thread.pinned)
      .sort((a, b) => {
        if (sort === "new") return +new Date(b.created_at) - +new Date(a.created_at);
        if (sort === "top") return b.helpful - a.helpful;
        return hotScore(b) - hotScore(a);
      }),
  ];
  const helpers = board.people
    .filter((person) => person.trust_score != null && threads.some((thread) => thread.author_id === person.id || board.replies.some((reply) => reply.author_id === person.id && reply.thread_id === thread.id)))
    .sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0));

  async function publish() {
    if (!title.trim() || !body.trim()) {
      setError("Add a title and say what you want neighbors to know.");
      return;
    }
    try {
      const thread = await createThread(activeId, title, body);
      if (thread?.held) {
        setHeldNote(thread.held_reason);
        setComposing(false);
        setTitle("");
        setBody("");
        setError(null);
        return;
      }
      setTitle("");
      setBody("");
      setComposing(false);
      setError(null);
      if (thread) go(`/hubs/${activeId}/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That post did not go up");
    }
  }

  return (
    <>
      <header className="hubhead" style={{ backgroundColor: hub.color }}>
        <button type="button" className="crumb" onClick={() => go("/hubs")}>Hubs › {hub.category}</button>
        <div className="row">
          <div>
            <h1>{hub.name}</h1>
            <p className="lede">{hub.description}</p>
            <div className="facts">
              {hub.private ? (
                <>
                  <span>Private</span><span>·</span><span>members are never shown</span>
                </>
              ) : (
                <>
                  <span>{hubStats(hub).split(" · ")[0]}</span><span>·</span><span>{hub.fact}</span>
                </>
              )}
              <span>·</span>
              <span>{hub.run_by}</span>
            </div>
          </div>
          <div className="acts">
            <button type="button" className="btn out" onClick={() => void cycleAlerts(hub.id)}>
              <Icon name="bell" />
              {alertLabel(hub.alerts)}
            </button>
            <button type="button" className={hub.joined ? "btn joined" : "btn"} onClick={() => void toggleJoin(hub.id)}>
              {hub.joined && <Icon name="check" />}
              {hub.joined ? "Joined" : "Join hub"}
            </button>
          </div>
        </div>
        <div className="hubtabs" role="tablist">
          <Tab id="threads" label="Threads" icon="msg" tab={tab} setTab={setTab} />
          <Tab id="map" label={hub.map_label} icon="pin" tab={tab} setTab={setTab} />
          <Tab id="requests" label="Requests" icon="hand" tab={tab} setTab={setTab} />
          <Tab id="news" label="News" icon="mega" tab={tab} setTab={setTab} />
          {tool && <span className="sep" />}
          {tool && (
            <button type="button" role="tab" aria-selected={tab === "tool"} className={tab === "tool" ? "on" : ""} onClick={() => setTab("tool")}>
              <Icon name="spark" />
              {tool.title} <span className="own">This hub</span>
            </button>
          )}
        </div>
      </header>
      <main className="dpage">
        {tab === "threads" && (
          <div className="g12">
            <article className="mod">
              {composing ? (
                <div className="composer-open">
                  <div className="who">
                    <span className="avatar">{me.initial}</span>
                    Posting as {me.name}
                  </div>
                  <div className="field" style={{ marginTop: 0 }}>
                    <label htmlFor="post-title">Title</label>
                    <input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What do you want to ask or share?" />
                  </div>
                  <div className="field">
                    <label htmlFor="post-body">Post</label>
                    <textarea id="post-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Keep addresses, phone numbers, and emails off the thread." />
                  </div>
                  {error && <p className="error">{error}</p>}
                  <div className="held-actions">
                    <button type="button" className="btn primary sm" onClick={() => void publish()}>Post</button>
                    <button type="button" className="btn sm" onClick={() => { setComposing(false); setError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="composer">
                  <span className="avatar">{me.initial}</span>
                  <input aria-label="Post" placeholder={`Ask a question or share something${hub.private ? "" : ` with ${hub.member_count ?? "your"} neighbors`}…`} onFocus={() => setComposing(true)} readOnly />
                  <button type="button" className="btn primary sm" onClick={() => setComposing(true)}>Post</button>
                </div>
              )}
              {heldNote && (
                <div className="held">
                  <Icon name="lock" />
                  <span>We held your post. {heldNote}</span>
                </div>
              )}
              {held.filter((thread) => thread.author_id === me.id).map((thread) => (
                <div key={thread.id} className="held">
                  <Icon name="lock" />
                  <span>We held “{thread.title}”. {thread.held_reason}</span>
                </div>
              ))}
              {held.some((thread) => thread.author_id !== me.id) && (
                <div className="held">
                  <Icon name="lock" />
                  <span>
                    {held.filter((thread) => thread.author_id !== me.id).length === 1
                      ? "1 post is held for review because it included a home address, phone, or email. We asked the author to remove it."
                      : `${held.filter((thread) => thread.author_id !== me.id).length} posts are held for review because they included a home address, phone, or email.`}
                  </span>
                </div>
              )}
              <div className="mod-h">
                <h2>Threads</h2>
                <div className="seg" role="group" aria-label="Sort">
                  {(
                    [
                      ["hot", "Hot"],
                      ["new", "New"],
                      ["top", "Top"],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>
                  ))}
                </div>
              </div>
              {ordered.length === 0 && <p className="empty">No threads match that.</p>}
              {ordered.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  replies={board.replies.filter((reply) => reply.thread_id === thread.id).length}
                  person={people.get(thread.author_id)}
                  onOpen={() => go(`/hubs/${hub.id}/${thread.id}`)}
                  onHelpful={() => void toggleHelpful("thread", thread.id)}
                />
              ))}
            </article>
            <div className="stack">
              <article className="mod">
                <div className="mod-h">
                  <h2>Trusted helpers</h2>
                  <button type="button" className="more" onClick={() => openTrust("list")}>Set a score</button>
                </div>
                <div className="mod-b">
                  <p className="mod-sub" style={{ padding: 0 }}>
                    Scores are typed by ComForce staff for people who keep helping. This list is not a ranking the app invented.
                  </p>
                  {helpers.length === 0 && <p className="empty">No scores in this hub yet.</p>}
                  {helpers.map((person) => (
                    <button key={person.id} type="button" className="helper" onClick={() => openTrust(person.id)} style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left" }}>
                      <b>{person.name}</b>
                      <span className="open">{person.trust_score}</span>
                      <small>{person.trust_note}</small>
                    </button>
                  ))}
                </div>
              </article>
              {hub.id === "food" && (
                <article className="mod">
                  <div className="mod-h" style={{ paddingBottom: 12 }}>
                    <h2>Open now</h2>
                    <button type="button" className="more" onClick={() => setTab("map")}>Full map</button>
                  </div>
                  <CityMap places={places.filter((place) => place.open)} color={hub.color} />
                  <div className="mod-b">
                    {places.map((place) => (
                      <div key={place.id} className="pantry">
                        <b>{place.name}</b>
                        <span className={place.open ? "open" : "open closed"}>{place.status}</span>
                        <p>{place.detail}</p>
                      </div>
                    ))}
                  </div>
                </article>
              )}
              {hub.id === "food" && (
                <article className="mod">
                  <div className="mod-h"><h2>Share food</h2></div>
                  <div className="mod-b">
                    <div className="seg" role="group" aria-label="Posting as">
                      {["Resident", "Store", "Organization"].map((role) => (
                        <button key={role} type="button" aria-pressed={postingAs === role} onClick={() => setPostingAs(role)}>{role}</button>
                      ))}
                    </div>
                    <div className="field">
                      <label htmlFor="share-what">What do you have?</label>
                      <input id="share-what" value={what} onChange={(event) => setWhat(event.target.value)} placeholder="2 boxes of diapers, size 4" />
                    </div>
                    <div className="field">
                      <label htmlFor="share-when">Pickup window</label>
                      <input id="share-when" value={whenText} onChange={(event) => setWhenText(event.target.value)} placeholder="Tonight until 9 PM" />
                    </div>
                    {shareNote && <p className={shareNote.startsWith("On the map") ? "mod-sub" : "error"} style={{ padding: 0 }}>{shareNote}</p>}
                    <button
                      type="button"
                      className="btn primary block"
                      style={{ marginTop: 16 }}
                      onClick={() => {
                        if (!what.trim() || !whenText.trim()) {
                          setShareNote("Say what you have and when someone can pick it up.");
                          return;
                        }
                        void shareFood(what, whenText, postingAs)
                          .then(() => {
                            setShareNote(`On the map · ${whenText.trim()}`);
                            setWhat("");
                            setWhenText("");
                          })
                          .catch((err: unknown) => setShareNote(err instanceof Error ? err.message : "That did not post"));
                      }}
                    >
                      Post to the map
                    </button>
                    <p className="mod-sub" style={{ display: "flex", gap: 8 }}>
                      <Icon name="lock" size={15} /> Your address is only shared with the person who claims it.
                    </p>
                  </div>
                </article>
              )}
              {hub.id === "domestic" && (
                <div className="tip" style={{ marginTop: 0 }}>
                  <Icon name="lamp" />
                  <span>
                    <b>Quick Exit is on this screen.</b> The red button, or Esc, turns the app into a bus schedule. Three taps on the blue bar bring you back.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "map" && (
          <div className="g12">
            <article className="mod">
              <CityMap places={places} color={hub.color} />
            </article>
            <article className="mod">
              <div className="mod-h">
                <h2>{places.length} places</h2>
                <span className="count">sample listings</span>
              </div>
              <div className="mod-b">
                {places.map((place) => (
                  <div key={place.id} className="pantry">
                    <b>{place.name}</b>
                    <span className={place.open ? "open" : "open closed"}>{place.status}</span>
                    <p>{place.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        )}
        {tab === "requests" && (
          <div className="g12">
            <article className="mod">
              <div className="mod-h">
                <h2>{hub.name.split("·")[0].trim()} requests</h2>
                <span className="count">{requests.filter((row) => !row.claimed_by).length} open</span>
              </div>
              <div className="mod-b">
                {requests.map((row) => (
                  <article key={row.id} className="req">
                    <div className="req-main">
                      <div className="req-meta">
                        <span className={`tag ${row.urgency === "Urgent" ? "urgent" : row.urgency === "Today" ? "today" : "week"}`}>{row.urgency}</span>
                        <span>{row.category}</span>
                        <span>{row.distance}</span>
                      </div>
                      <h3>{row.title}</h3>
                      {row.why && <p className="why"><Icon name="spark" size={15} />{row.why}</p>}
                    </div>
                    <button type="button" className="take" disabled={Boolean(row.claimed_by)} onClick={() => void claim(row.id)}>
                      <Icon name="hand" />
                      <span>{row.claimed_by ? "Taken" : "Take it"}</span>
                      <small>#{row.id}</small>
                    </button>
                  </article>
                ))}
              </div>
            </article>
            <div className="tip" style={{ marginTop: 0 }}>
              <Icon name="lamp" />
              <span>These are the same requests as the main Requests page, filtered to this hub.</span>
            </div>
          </div>
        )}
        {tab === "news" && (
          <article className="mod">
            <div className="mod-h"><h2>News</h2></div>
            {news.map((item) => (
              <div key={item.id} className="bc">
                <span className="sq"><Icon name={item.icon} /></span>
                <div>
                  <span className="stats">{when(item.created_at)} · from {item.source}</span>
                  <b style={{ display: "block" }}>{item.title}</b>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </article>
        )}
        {tab === "tool" && tool && (
          <ToolPanel
            tool={tool}
            offer={offer}
            setOffer={setOffer}
            onAdd={() => {
              if (!offer.trim()) return;
              void addToolItem(tool.id, offer).then(() => setOffer(""));
            }}
            onAdvance={(itemId) => void advanceItem(tool.id, itemId)}
          />
        )}
      </main>
    </>
  );
}

function Tab({
  id,
  label,
  icon,
  tab,
  setTab,
}: {
  id: HubTab;
  label: string;
  icon: string;
  tab: HubTab;
  setTab: (tab: HubTab) => void;
}) {
  return (
    <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
      <Icon name={icon} />
      {label}
    </button>
  );
}

function ThreadRow({
  thread,
  replies,
  person,
  onOpen,
  onHelpful,
}: {
  thread: Thread;
  replies: number;
  person: ReturnType<ReturnType<typeof useHubs>["people"]["get"]>;
  onOpen: () => void;
  onHelpful: () => void;
}) {
  if (!person) return null;
  return (
    <div className={thread.pinned ? "post pinned" : "post"}>
      <Vote pressed={thread.helpful_by_me} count={thread.helpful} onClick={onHelpful} />
      <div className="thread">
        <Byline person={person} when={thread.pinned ? "pinned" : when(thread.created_at)} />
        <h3>
          <button type="button" onClick={onOpen}>{thread.title}</button>
        </h3>
        {thread.flair && <div style={{ marginTop: 8 }}><Flair name={thread.flair} /></div>}
        {thread.steps ? (
          <ol>{thread.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        ) : (
          <p>{thread.body}</p>
        )}
        {thread.ai_answer && (
          <div className="answer">
            <Icon name="spark" size={15} />
            <span><b>Answered automatically. </b>{thread.ai_answer}</span>
          </div>
        )}
        {!thread.pinned && (
          <div className="acts">
            <button type="button" onClick={onOpen}>{replies} {replies === 1 ? "reply" : "replies"}</button>
            <span>Helpful · {thread.helpful}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolPanel({
  tool,
  offer,
  setOffer,
  onAdd,
  onAdvance,
}: {
  tool: NonNullable<ReturnType<typeof useHubs>["board"]>["tools"][number];
  offer: string;
  setOffer: (value: string) => void;
  onAdd: () => void;
  onAdvance: (itemId: string) => void;
}) {
  return (
    <article className="mod">
      <div className="mod-h">
        <h2>{tool.title}</h2>
        <span className="tag ai">This hub</span>
      </div>
      <p className="mod-sub">{tool.blurb}</p>
      <div className="mod-b">
        {tool.kind === "stock" && (
          <>
            <ul className="stock">
              {tool.items.map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <span className="bar"><i style={{ width: `${item.gap ?? 0}%` }} /></span>
                  <b>−{item.gap}%</b>
                </li>
              ))}
            </ul>
            {tool.note && <p className="why" style={{ marginTop: 24 }}><Icon name="spark" size={15} />{tool.note}</p>}
          </>
        )}
        {tool.kind === "route" && (
          <ol>
            {tool.items.map((item) => (
              <li key={item.id} style={{ marginBottom: 8 }}>
                {item.title} {item.meta && <b>{item.meta}</b>}
              </li>
            ))}
          </ol>
        )}
        {tool.kind === "episodes" && tool.items.map((item) => (
          <div key={item.id} className="pantry">
            <b>{item.title}</b>
            <span className="open">{item.status}</span>
            <p>{item.meta}</p>
          </div>
        ))}
        {(tool.kind === "sectors" || tool.kind === "checks" || tool.kind === "events") && (
          <div className="sectorgrid">
            {tool.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sector ${(item.status ?? "").toLowerCase()}`}
                onClick={() => onAdvance(item.id)}
              >
                <b>{item.title}</b>
                <span>{item.meta}</span>
                <em>
                  {tool.kind === "events"
                    ? `${item.going ?? 0} going${item.mine ? " · you are going" : " · tap to go"}`
                    : item.status}
                </em>
              </button>
            ))}
          </div>
        )}
        {tool.kind === "board" && (
          <>
            {tool.items.map((item) => (
              <div key={item.id} className="pantry">
                <b>{item.title}</b>
                <span className="open">{item.status}</span>
                <p>{item.meta}</p>
              </div>
            ))}
            <div className="field">
              <label htmlFor="offer">{tool.form_label ?? "Add one"}</label>
              <input id="offer" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder={tool.form_placeholder} />
            </div>
            <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={onAdd}>Post to the board</button>
          </>
        )}
      </div>
    </article>
  );
}
