import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TrustDialog } from "./bits";
import { Icon, Logo } from "./icons";
import { go } from "./route";
import { useHubs } from "./store";
import type { Route } from "./types";

const SearchContext = createContext({ query: "", setQuery: (_query: string) => {} });

export function useQuery() {
  return useContext(SearchContext);
}

function navOn(route: Route, name: string): boolean {
  if (name === "hubs") return route.name === "hubs" || route.name === "hub" || route.name === "thread";
  return route.name === name;
}

export function Shell({
  route,
  onExit,
  shake,
  setShake,
  children,
}: {
  route: Route;
  onExit: () => void;
  shake: boolean;
  setShake: (value: boolean) => void;
  children: ReactNode;
}) {
  const { board, me, openTrust, markNoticesRead } = useHubs();
  const [query, setQuery] = useState("");
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const unread = board?.notices.some((notice) => notice.unread) ?? false;
  const placeholder =
    route.name === "hub" || route.name === "thread" ? "Search this hub" : route.name === "hubs" ? "Search hubs" : "Search help, places, hubs";

  useEffect(() => {
    setQuery("");
    setNoticesOpen(false);
    setAccountOpen(false);
  }, [route]);

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      <div className="app">
        <header className="dnav">
          <button type="button" className="logo" onClick={() => go("/home")}>
            <Logo />
            <b>
              ComForce <span>MKE</span>
            </b>
          </button>
          <nav aria-label="Main">
            {(
              [
                ["home", "Home"],
                ["map", "Map"],
                ["hubs", "Hubs"],
                ["requests", "Requests"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={navOn(route, id) ? "on" : ""} onClick={() => go(id === "home" ? "/home" : `/${id}`)}>
                {navOn(route, id) ? <span>{label}</span> : label}
              </button>
            ))}
          </nav>
          <div className="dtools">
            <label className="dsearch">
              <Icon name="search" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
              />
            </label>
            <button
              type="button"
              className="iconbtn"
              aria-label="Notifications"
              onClick={() => {
                setAccountOpen(false);
                setNoticesOpen((open) => !open);
                if (!noticesOpen) void markNoticesRead();
              }}
            >
              <Icon name="bell" />
              {unread && <i className="badge" />}
            </button>
            <button
              type="button"
              className="avatar"
              aria-label={me ? me.name : "Account"}
              onClick={() => {
                setNoticesOpen(false);
                setAccountOpen((open) => !open);
              }}
            >
              {me?.initial ?? "J"}
            </button>
            <button type="button" className="esc" onClick={onExit}>
              <kbd>esc</kbd>Quick exit
            </button>
          </div>
        </header>
        {noticesOpen && board && (
          <div className="menu notices" role="menu">
            {board.notices.length === 0 && <p className="empty">No notices yet.</p>}
            {board.notices.map((notice) => (
              <button
                key={notice.id}
                type="button"
                className={notice.unread ? "notice unread" : "notice"}
                onClick={() => go(`/hubs/${notice.hub_id}/${notice.thread_id}`)}
              >
                <b>{notice.title}</b>
                <small>{notice.body}</small>
              </button>
            ))}
          </div>
        )}
        {accountOpen && me && (
          <div className="menu" role="menu">
            <div className="account-head">
              <b>{me.name}</b>
              <span>{me.title} · signed in for this demo</span>
            </div>
            <button type="button" className="row" onClick={() => openTrust("list")}>
              <b>Trust scores</b>
              <small>Type a score for someone who keeps helping. Nothing here is calculated.</small>
            </button>
            <div className="setrow">
              <span>
                <b>Also exit when I shake my phone</b>
                <small style={{ display: "block", color: "var(--ink-3)" }}>Handy when your hands are full.</small>
              </span>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={shake}
                aria-label="Shake to exit"
                onClick={() => setShake(!shake)}
              >
                <i />
              </button>
            </div>
          </div>
        )}
        {children}
        <TrustDialog />
      </div>
    </SearchContext.Provider>
  );
}

export function Disguise({ taps, onTap }: { taps: number; onTap: () => void }) {
  const stops = [
    ["Broadway & State", "6:18"],
    ["Water & Kilbourn", "6:21"],
    ["Wisconsin & Jackson", "6:24"],
    ["Prospect & Ogden", "6:28"],
    ["Martin Luther King & North", "6:33"],
    ["Locust & Humboldt", "6:37"],
  ];
  return (
    <div className="disguise">
      <button type="button" className="bluebar" onClick={onTap}>
        <span>MCTS · Route 30</span>
        <span className="dots" aria-hidden="true">
          <i className={taps > 0 ? "on" : ""} />
          <i className={taps > 1 ? "on" : ""} />
          <i className={taps > 2 ? "on" : ""} />
        </span>
        <small>Eastbound</small>
      </button>
      <div className="schedule">
        <h1>Transit Schedule</h1>
        <p>Next buses from downtown. Times are the afternoon board.</p>
        <article className="route-card">
          <h2>Route 30 · Sherman / Wisconsin</h2>
          {stops.map(([stop, time]) => (
            <div key={stop} className="stop">
              <span>{stop}</span>
              <b>{time}</b>
            </div>
          ))}
        </article>
        <article className="route-card">
          <h2>Route 15 · Holton / Kinnickinnic</h2>
          <div className="stop"><span>Wisconsin & Jackson</span><b>6:26</b></div>
          <div className="stop"><span>Brady & Franklin</span><b>6:31</b></div>
          <div className="stop"><span>North & Humboldt</span><b>6:36</b></div>
        </article>
      </div>
    </div>
  );
}
