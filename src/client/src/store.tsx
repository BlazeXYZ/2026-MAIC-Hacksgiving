import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  localAdvance,
  localAlerts,
  localClaim,
  localHelpful,
  localJoin,
  localReadNotices,
  localReply,
  localShare,
  localSuggestion,
  localThread,
  localToolItem,
  localTrust,
} from "./local";
import { isStaff, personMap } from "./rules";
import { seedBoard } from "./seed";
import type { Board, Person, Thread } from "./types";

const LOCAL_KEY = "comforce.hubs.board.v1";

type Store = {
  board: Board | null;
  ready: boolean;
  offline: boolean;
  me: Person | null;
  staff: boolean;
  trustTarget: string | "list" | null;
  openTrust: (target: string | "list" | null) => void;
  people: Map<string, Person>;
  createThread: (hubId: string, title: string, body: string) => Promise<Thread | undefined>;
  reply: (threadId: string, body: string, parentId: string | null) => Promise<void>;
  toggleHelpful: (kind: "thread" | "reply", id: string) => Promise<void>;
  setTrust: (personId: string, score: number | null, note: string) => Promise<void>;
  toggleJoin: (hubId: string) => Promise<void>;
  cycleAlerts: (hubId: string) => Promise<void>;
  suggest: (name: string, audience: string, why: string) => Promise<void>;
  claim: (requestId: string) => Promise<void>;
  addToolItem: (toolId: string, title: string) => Promise<void>;
  advanceItem: (toolId: string, itemId: string) => Promise<void>;
  shareFood: (what: string, when: string, postingAs: string) => Promise<void>;
  markNoticesRead: () => Promise<void>;
};

const HubsContext = createContext<Store | null>(null);

function readLocal(): Board | null {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as Board;
  } catch {
    return null;
  }
}

function writeLocal(board: Board) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(board));
  } catch {
    /* private mode or a full disk should not block the screen */
  }
}

export function HubsProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [trustTarget, setTrustTarget] = useState<string | "list" | null>(null);
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  useEffect(() => {
    let cancel = false;
    const local = readLocal();
    fetch("/api/hubs/board")
      .then(async (response) => {
        if (!response.ok) throw new Error("down");
        return (await response.json()) as Board;
      })
      .then((remote) => {
        if (cancel) return;
        const current = boardRef.current;
        if (current && current.revision > remote.revision) return;
        if (local && local.revision > remote.revision) {
          setBoard(local);
          setOffline(true);
          return;
        }
        setBoard(remote);
        writeLocal(remote);
      })
      .catch(() => {
        if (cancel) return;
        setOffline(true);
        setBoard(local ?? seedBoard());
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  function commit(next: Board) {
    boardRef.current = next;
    setBoard(next);
    writeLocal(next);
  }

  async function send(path: string, init: RequestInit | undefined, apply: (current: Board) => Board): Promise<Board> {
    const current = boardRef.current;
    if (!current) throw new Error("Hubs are still opening");
    if (offline) {
      const next = apply(current);
      commit(next);
      return next;
    }
    try {
      const response = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      if ([403, 404, 409, 422].includes(response.status)) {
        const body = (await response.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(typeof body.detail === "string" ? body.detail : "That did not save");
      }
      if (!response.ok) throw new Error("The hub could not save that");
      const next = (await response.json()) as Board;
      commit(next);
      return next;
    } catch (error) {
      if (error instanceof TypeError) {
        setOffline(true);
        const next = apply(current);
        commit(next);
        return next;
      }
      throw error;
    }
  }

  const people = useMemo(() => (board ? personMap(board) : new Map<string, Person>()), [board]);
  const me = board ? people.get(board.me_id) ?? null : null;

  const value: Store = {
    board,
    ready,
    offline,
    me,
    staff: isStaff(me ?? undefined),
    trustTarget,
    openTrust: setTrustTarget,
    people,
    async createThread(hubId, title, body) {
      const next = await send(`/api/hubs/${hubId}/threads`, { method: "POST", body: JSON.stringify({ title, body }) }, (current) =>
        localThread(current, hubId, title, body),
      );
      return next.threads.find((thread) => thread.hub_id === hubId && thread.title === title.trim() && thread.author_id === next.me_id);
    },
    reply(threadId, body, parentId) {
      return send(
        `/api/hubs/threads/${threadId}/replies`,
        { method: "POST", body: JSON.stringify({ body, parent_id: parentId }) },
        (current) => localReply(current, threadId, body, parentId),
      ).then(() => undefined);
    },
    toggleHelpful(kind, itemId) {
      const path = kind === "thread" ? `/api/hubs/threads/${itemId}/helpful` : `/api/hubs/replies/${itemId}/helpful`;
      return send(path, { method: "POST" }, (current) => localHelpful(current, kind, itemId)).then(() => undefined);
    },
    setTrust(personId, score, note) {
      return send(
        `/api/hubs/people/${personId}/trust`,
        { method: "PATCH", body: JSON.stringify({ score, note }) },
        (current) => localTrust(current, personId, score, note),
      ).then(() => undefined);
    },
    toggleJoin(hubId) {
      return send(`/api/hubs/${hubId}/join`, { method: "POST" }, (current) => localJoin(current, hubId)).then(() => undefined);
    },
    cycleAlerts(hubId) {
      const mode = boardRef.current?.hubs.find((hub) => hub.id === hubId)?.alerts ?? "important";
      const next = mode === "important" ? "all" : mode === "all" ? "off" : "important";
      return send(`/api/hubs/${hubId}/alerts/${next}`, { method: "POST" }, (current) => localAlerts(current, hubId)).then(
        () => undefined,
      );
    },
    suggest(name, audience, why) {
      return send(
        "/api/hubs/suggestions",
        { method: "POST", body: JSON.stringify({ name, audience, why }) },
        (current) => localSuggestion(current, name, audience, why),
      ).then(() => undefined);
    },
    claim(requestId) {
      return send(`/api/hubs/requests/${requestId}/claim`, { method: "POST" }, (current) => localClaim(current, requestId)).then(
        () => undefined,
      );
    },
    addToolItem(toolId, title) {
      return send(
        `/api/hubs/tools/${toolId}/items`,
        { method: "POST", body: JSON.stringify({ title }) },
        (current) => localToolItem(current, toolId, title),
      ).then(() => undefined);
    },
    advanceItem(toolId, itemId) {
      return send(`/api/hubs/tools/${toolId}/items/${itemId}/advance`, { method: "POST" }, (current) =>
        localAdvance(current, toolId, itemId),
      ).then(() => undefined);
    },
    shareFood(what, when, postingAs) {
      return send(
        "/api/hubs/food/share",
        { method: "POST", body: JSON.stringify({ what, when, posting_as: postingAs }) },
        (current) => localShare(current, what, when, postingAs),
      ).then(() => undefined);
    },
    markNoticesRead() {
      return send("/api/hubs/notices/read", { method: "POST" }, localReadNotices).then(() => undefined);
    },
  };

  return <HubsContext.Provider value={value}>{children}</HubsContext.Provider>;
}

export function useHubs(): Store {
  const store = useContext(HubsContext);
  if (!store) throw new Error("Hubs are only available inside the app shell");
  return store;
}
