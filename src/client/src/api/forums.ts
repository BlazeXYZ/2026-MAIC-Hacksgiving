import { apiFetch } from './transport';
import { COORDINATOR_KEY_HEADER } from '../coordinator/access';
import type {
  ForumHubId,
  HeldPost,
  MissingPersonCase,
  PrivateTip,
  ReplyPosted,
  ReviewAction,
  ReviewResult,
  ThreadDetail,
  ThreadList,
  ThreadPosted,
  ThreadSort,
} from '../contracts/forums';

/**
 * Client for the hub forums API (`/api/v1/forums`).
 *
 * Coordinator calls send `X-Coordinator-Key`. The key and the poster's pseudonym live only in
 * React memory, so nothing about the forum is written to browser storage.
 */

const BASE = '/api/v1/forums';
const TIMEOUT_MS = 10_000;

export class ForumApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(typeof detail === 'string' ? detail : `Request failed with ${status}`);
  }
}

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  key?: string | null;
}

async function call<T>(path: string, { method = 'GET', body, key }: CallOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers[COORDINATOR_KEY_HEADER] = key;
    const res = await apiFetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? (data as { detail: unknown }).detail : data;
      throw new ForumApiError(res.status, detail);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** A short message for anything a forum call threw. */
export function forumErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ForumApiError) {
    if (typeof err.detail === 'string') return err.detail;
    if (err.status === 422) return 'Check the title and message, then try again.';
  }
  return fallback;
}

export function listThreads(hubId: ForumHubId, sort: ThreadSort, q: string): Promise<ThreadList> {
  const params = new URLSearchParams({ sort });
  if (q.trim()) params.set('q', q.trim());
  return call<ThreadList>(`/hubs/${hubId}/threads?${params.toString()}`);
}

export function getThread(threadId: string): Promise<ThreadDetail> {
  return call<ThreadDetail>(`/threads/${encodeURIComponent(threadId)}`);
}

export function createThread(
  hubId: ForumHubId,
  title: string,
  body: string,
  handle: string | null,
  key: string | null,
): Promise<ThreadPosted> {
  return call<ThreadPosted>(`/hubs/${hubId}/threads`, { method: 'POST', body: { title, body, handle }, key });
}

export function createReply(
  threadId: string,
  body: string,
  parentId: string | null,
  handle: string | null,
  key: string | null,
  sector: string | null = null,
): Promise<ReplyPosted> {
  return call<ReplyPosted>(`/threads/${encodeURIComponent(threadId)}/replies`, {
    method: 'POST',
    body: sector ? { body, parent_id: parentId, handle, sector } : { body, parent_id: parentId, handle },
    key,
  });
}

export function listCases(): Promise<MissingPersonCase[]> {
  return call<MissingPersonCase[]>('/cases');
}

export function openCase(key: string, displayName: string, lastKnownPoint: string): Promise<MissingPersonCase> {
  return call<MissingPersonCase>('/admin/cases', {
    method: 'POST',
    body: { display_name: displayName, last_known_point: lastKnownPoint },
    key,
  });
}

export function resolveCase(key: string, caseId: string): Promise<MissingPersonCase> {
  return call<MissingPersonCase>(`/admin/cases/${encodeURIComponent(caseId)}/resolve`, { method: 'POST', key });
}

export function listPrivateTips(key: string): Promise<PrivateTip[]> {
  return call<PrivateTip[]>('/admin/private-tips', { key });
}

export function markHelpful(kind: 'thread' | 'reply', id: string, on: boolean): Promise<{ helpful: number }> {
  const path = kind === 'thread' ? `/threads/${encodeURIComponent(id)}/helpful` : `/replies/${encodeURIComponent(id)}/helpful`;
  return call<{ helpful: number }>(path, { method: 'POST', body: { on } });
}

export function listHeld(key: string): Promise<HeldPost[]> {
  return call<HeldPost[]>('/admin/held', { key });
}

export function reviewHeld(key: string, id: string, action: ReviewAction, body?: string): Promise<ReviewResult> {
  return call<ReviewResult>(`/admin/held/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: body === undefined ? { action } : { action, body },
    key,
  });
}
