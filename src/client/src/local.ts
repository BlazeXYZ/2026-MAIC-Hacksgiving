import { automaticAnswer, holdReason, nextAlerts } from "./rules";
import type { Board, Thread } from "./types";

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function bump(board: Board, patch: Partial<Board>): Board {
  return { ...board, ...patch, revision: board.revision + 1 };
}

export function localThread(board: Board, hubId: string, title: string, body: string): Board {
  const reason = holdReason(`${title}\n${body}`);
  const thread: Thread = {
    id: id("thread"),
    hub_id: hubId,
    author_id: board.me_id,
    title: title.trim(),
    body: body.trim(),
    created_at: new Date().toISOString(),
    pinned: false,
    helpful: 0,
    helpful_by_me: false,
    flair: title.includes("?") ? "Question" : null,
    steps: null,
    ai_answer: reason ? null : automaticAnswer(hubId, `${title}\n${body}`),
    held: reason != null,
    held_reason: reason,
  };
  return bump(board, { threads: [thread, ...board.threads] });
}

export function localReply(board: Board, threadId: string, body: string, parentId: string | null): Board {
  const reason = holdReason(body);
  if (reason) throw new Error(reason);
  const thread = board.threads.find((row) => row.id === threadId);
  if (!thread || thread.held) throw new Error("This post is held. It is not public yet.");
  return bump(board, {
    replies: [
      ...board.replies,
      {
        id: id("reply"),
        thread_id: threadId,
        author_id: board.me_id,
        body: body.trim(),
        created_at: new Date().toISOString(),
        parent_id: parentId,
        helpful: 0,
        helpful_by_me: false,
      },
    ],
  });
}

export function localHelpful(board: Board, kind: "thread" | "reply", itemId: string): Board {
  if (kind === "thread") {
    return bump(board, {
      threads: board.threads.map((row) =>
        row.id === itemId
          ? {
              ...row,
              helpful: row.helpful_by_me ? Math.max(0, row.helpful - 1) : row.helpful + 1,
              helpful_by_me: !row.helpful_by_me,
            }
          : row,
      ),
    });
  }
  return bump(board, {
    replies: board.replies.map((row) =>
      row.id === itemId
        ? {
            ...row,
            helpful: row.helpful_by_me ? Math.max(0, row.helpful - 1) : row.helpful + 1,
            helpful_by_me: !row.helpful_by_me,
          }
        : row,
    ),
  });
}

export function localTrust(board: Board, personId: string, score: number | null, note: string): Board {
  const me = board.people.find((person) => person.id === board.me_id);
  return bump(board, {
    people: board.people.map((person) =>
      person.id === personId
        ? {
            ...person,
            trust_score: score,
            trust_note: note.trim() || null,
            trust_set_by: score == null ? null : me?.name ?? "ComForce staff",
          }
        : person,
    ),
  });
}

export function localJoin(board: Board, hubId: string): Board {
  return bump(board, {
    hubs: board.hubs.map((hub) => {
      if (hub.id !== hubId) return hub;
      const joined = !hub.joined;
      const memberCount =
        hub.private || hub.member_count == null ? hub.member_count : hub.member_count + (joined ? 1 : -1);
      return { ...hub, joined, member_count: memberCount };
    }),
  });
}

export function localAlerts(board: Board, hubId: string): Board {
  return bump(board, {
    hubs: board.hubs.map((hub) => (hub.id === hubId ? { ...hub, alerts: nextAlerts(hub.alerts) } : hub)),
  });
}

export function localSuggestion(board: Board, name: string, audience: string, why: string): Board {
  return bump(board, {
    suggestions: [
      {
        id: id("idea"),
        name: name.trim(),
        audience: audience.trim(),
        why: why.trim(),
        created_at: new Date().toISOString(),
      },
      ...board.suggestions,
    ],
  });
}

export function localClaim(board: Board, requestId: string): Board {
  return bump(board, {
    requests: board.requests.map((row) =>
      row.id === requestId ? { ...row, claimed_by: row.claimed_by ?? board.me_id } : row,
    ),
  });
}

export function localToolItem(board: Board, toolId: string, title: string): Board {
  const me = board.people.find((person) => person.id === board.me_id);
  return bump(board, {
    tools: board.tools.map((tool) =>
      tool.id === toolId
        ? {
            ...tool,
            items: [
              { id: id("item"), title: title.trim(), meta: `${me?.name ?? "You"} · just now`, status: "Open" },
              ...tool.items,
            ],
          }
        : tool,
    ),
  });
}

export function localAdvance(board: Board, toolId: string, itemId: string): Board {
  return bump(board, {
    tools: board.tools.map((tool) => {
      if (tool.id !== toolId) return tool;
      return {
        ...tool,
        items: tool.items.map((item) => {
          if (item.id !== itemId) return item;
          if (tool.kind === "sectors") {
            const order = ["Pending", "Searching", "Cleared"];
            const index = order.indexOf(item.status ?? "Pending");
            return { ...item, status: order[(index + 1) % order.length] };
          }
          if (tool.kind === "checks") {
            return { ...item, status: item.status === "Done" ? "Open" : "Done" };
          }
          if (tool.kind === "events") {
            const mine = !item.mine;
            return {
              ...item,
              mine,
              going: (item.going ?? 0) + (mine ? 1 : -1),
              status: mine ? "Going" : "Listed",
            };
          }
          return item;
        }),
      };
    }),
  });
}

export function localShare(board: Board, what: string, when: string, postingAs: string): Board {
  const reason = holdReason(`${what}\n${when}`);
  if (reason) throw new Error(reason);
  const me = board.people.find((person) => person.id === board.me_id);
  return bump(board, {
    places: [
      {
        id: id("place"),
        hub_id: "food",
        name: what.trim(),
        detail: `${postingAs.trim()} · ${when.trim()}`,
        status: when.trim(),
        open: true,
        x: 48,
        y: 52,
      },
      ...board.places,
    ],
    threads: [
      {
        id: id("thread"),
        hub_id: "food",
        author_id: board.me_id,
        title: `${what.trim()}, free`,
        body: `Posted by ${me?.name ?? "You"} as a ${postingAs.trim().toLowerCase()}. Pickup: ${when.trim()}. The address stays with the person who claims it.`,
        created_at: new Date().toISOString(),
        pinned: false,
        helpful: 0,
        helpful_by_me: false,
        flair: "Offer",
        steps: null,
        ai_answer: null,
        held: false,
        held_reason: null,
      },
      ...board.threads,
    ],
  });
}

export function localReadNotices(board: Board): Board {
  return bump(board, { notices: board.notices.map((notice) => ({ ...notice, unread: false })) });
}
