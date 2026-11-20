export type Role = "neighbor" | "volunteer" | "employee" | "coordinator" | "organization";

export type Person = {
  id: string;
  name: string;
  initial: string;
  color: string;
  role: Role;
  title: string;
  neighborhood: string | null;
  trust_score: number | null;
  trust_note: string | null;
  trust_set_by: string | null;
};

export type Alerts = "important" | "all" | "off";

export type Hub = {
  id: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  color: string;
  icon: string;
  private: boolean;
  member_count: number | null;
  stats_extra: string;
  chips: string[];
  map_label: string;
  own_tool_id: string;
  joined: boolean;
  suggested: boolean;
  flag: string | null;
  flag_hot: boolean;
  run_by: string;
  fact: string;
  alerts: Alerts;
};

export type Thread = {
  id: string;
  hub_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  pinned: boolean;
  helpful: number;
  helpful_by_me: boolean;
  flair: string | null;
  steps: string[] | null;
  ai_answer: string | null;
  held: boolean;
  held_reason: string | null;
};

export type Reply = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  helpful: number;
  helpful_by_me: boolean;
};

export type NewsItem = {
  id: string;
  hub_id: string;
  title: string;
  body: string;
  source: string;
  created_at: string;
  icon: string;
};

export type Place = {
  id: string;
  hub_id: string;
  name: string;
  detail: string;
  status: string;
  open: boolean;
  x: number;
  y: number;
};

export type AidRequest = {
  id: string;
  hub_id: string;
  title: string;
  urgency: string;
  category: string;
  distance: string;
  why: string | null;
  claimed_by: string | null;
};

export type ToolItem = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
  gap?: number;
  going?: number;
  mine?: boolean;
};

export type Tool = {
  id: string;
  hub_id: string;
  kind: "sectors" | "stock" | "route" | "board" | "events" | "checks" | "episodes";
  title: string;
  blurb: string;
  note?: string;
  form_label?: string;
  form_placeholder?: string;
  items: ToolItem[];
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  hub_id: string;
  thread_id: string;
  created_at: string;
  unread: boolean;
};

export type Suggestion = {
  id: string;
  name: string;
  audience: string;
  why: string;
  created_at: string;
};

export type Board = {
  revision: number;
  me_id: string;
  people: Person[];
  hubs: Hub[];
  threads: Thread[];
  replies: Reply[];
  news: NewsItem[];
  places: Place[];
  requests: AidRequest[];
  tools: Tool[];
  notices: Notice[];
  suggestions: Suggestion[];
};

export type Route =
  | { name: "home" }
  | { name: "map" }
  | { name: "hubs" }
  | { name: "requests" }
  | { name: "hub"; hubId: string }
  | { name: "thread"; hubId: string; threadId: string };

export type HubTab = "threads" | "map" | "requests" | "news" | "tool";
