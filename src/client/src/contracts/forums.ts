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
}

export type ReviewAction = 'publish' | 'remove';

export interface ReviewResult {
  id: string;
  action: ReviewAction;
  /** The text as published, after scrubbing. Null when removed. */
  body: string | null;
}
