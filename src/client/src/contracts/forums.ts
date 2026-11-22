/**
 * Hub forum contracts.
 * Keep these field names aligned with `src/server/api/forums.py`.
 */

export type ForumHubId = 'domestic-safety' | 'missing-persons' | 'food-pantry';
export type ThreadSort = 'hot' | 'new' | 'top';
export type PostStatus = 'published' | 'held';
export type AuthorRole = 'neighbor' | 'volunteer' | 'coordinator' | 'organization';

export interface ReplyView {
  id: string;
  thread_id: string;
  author: string;
  role: AuthorRole;
  body: string;
  created_at: string;
  parent_id: string | null;
  helpful: number;
  /** `Verified` on a lead tip a coordinator published. */
  flair?: string | null;
  /** Search grid sector a lead tip names, like C2. */
  sector?: string | null;
}

export interface ThreadSummary {
  id: string;
  hub_id: ForumHubId;
  author: string;
  role: AuthorRole;
  title: string;
  body: string;
  created_at: string;
  pinned: boolean;
  flair: string | null;
  steps: string[] | null;
  /** An automatic answer for a common question or crisis wording. */
  answer: string | null;
  helpful: number;
  reply_count: number;
  /** Set on a missing-person case's lead thread. Every reply is held for review. */
  case_id?: string | null;
  /** A resolved case's lead thread takes no replies. */
  locked?: boolean;
}

export interface ThreadDetail extends ThreadSummary {
  replies: ReplyView[];
}

export interface ThreadList {
  hub_id: ForumHubId;
  threads: ThreadSummary[];
  /** Posts waiting for a coordinator. Their text is never sent here. */
  held_count: number;
}

interface PostResult {
  status: PostStatus;
  held_reason: string | null;
  /** The pseudonym this post went up under. Send it back to keep it. */
  handle: string;
}

export interface ThreadPosted extends PostResult {
  thread: ThreadSummary;
}

export interface ReplyPosted extends PostResult {
  reply: ReplyView;
}

export interface HeldPost {
  id: string;
  kind: 'thread' | 'reply';
  hub_id: ForumHubId;
  thread_id: string;
  thread_title: string;
  author: string;
  title: string | null;
  body: string;
  held_reason: string;
  created_at: string;
  /** Set when this is a tip on a case lead thread. Only these can be kept private. */
  case_id?: string | null;
  sector?: string | null;
}

/** A lead tip a coordinator kept private. Only ever sent to coordinators. */
export interface PrivateTip {
  id: string;
  case_id: string;
  thread_id: string;
  thread_title: string;
  author: string;
  body: string;
  sector: string | null;
  created_at: string;
}

export type CaseStatus = 'active' | 'resolved';

export interface MissingPersonCase {
  id: string;
  display_name: string;
  last_known_point: string;
  status: CaseStatus;
  thread_id: string;
  created_at: string;
  resolved_at: string | null;
}

export type ReviewAction = 'publish' | 'keep_private' | 'remove';

export interface ReviewResult {
  id: string;
  action: ReviewAction;
  /** The text as published, after scrubbing. Null when removed. */
  body: string | null;
}
