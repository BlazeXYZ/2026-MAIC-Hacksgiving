import raw from "../../../data/processed/hubs.json";
import type { Board, Reply, Thread } from "./types";

type Timed = { minutes_ago?: number; created_at?: string };

function stamp(row: Timed): string {
  const minutes = row.minutes_ago ?? 0;
  return new Date(Date.now() - minutes * 60000).toISOString();
}

/** Same starting board the API builds, for when the server is not running. */
export function seedBoard(): Board {
  const threads = (raw.threads as (Thread & Timed)[]).map((row) => {
    const { minutes_ago: _minutes, ...rest } = row;
    return { ...rest, created_at: stamp(row), helpful_by_me: false };
  });
  const replies = (raw.replies as (Reply & Timed)[]).map((row) => {
    const { minutes_ago: _minutes, ...rest } = row;
    return { ...rest, created_at: stamp(row), helpful_by_me: false };
  });
  const news = raw.news.map((row) => {
    const { minutes_ago: _minutes, ...rest } = row;
    return { ...rest, created_at: stamp(row) };
  });
  const notices = raw.notices.map((row) => {
    const { minutes_ago: _minutes, ...rest } = row;
    return { ...rest, created_at: stamp(row) };
  });
  return {
    revision: 1,
    me_id: "jordan",
    people: raw.people,
    hubs: raw.hubs.map((hub) => ({ ...hub, alerts: "important" as const })),
    threads,
    replies,
    news,
    places: raw.places,
    requests: raw.requests,
    tools: raw.tools,
    notices,
    suggestions: [],
  } as Board;
}
