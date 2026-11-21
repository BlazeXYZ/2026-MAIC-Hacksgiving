import type {
  AliasView,
  CatalogItem,
  DemandView,
  EntryKind,
  EntryResult,
  GuessView,
  HandoffView,
  ItemRef,
  MatchView,
  PlaceDetailData,
  PlaceSummary,
  PostEntryBody,
  SimilarItemsDetail,
  UnresolvedView,
} from '../contracts/inventory';

/**
 * Client for the community inventory API (`/api/v1/inventory`).
 *
 * Coordinator calls send `X-Coordinator-Key`. The key lives only in memory, so Quick Exit, which
 * unmounts the app, wipes it.
 */

const BASE = '/api/v1/inventory';
const TIMEOUT_MS = 10_000;

export class InventoryApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`Request failed with ${status}`);
  }
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  key?: string;
}

async function call<T>(path: string, { method = 'GET', body, key }: CallOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers['X-Coordinator-Key'] = key;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? (data as { detail: unknown }).detail : data;
      throw new InventoryApiError(res.status, detail);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** The 409 detail for "this looks like an item we already have", or null for any other error. */
export function similarItemsFrom(err: unknown): SimilarItemsDetail | null {
  if (!(err instanceof InventoryApiError) || err.status !== 409) return null;
  const d = err.detail;
  if (d && typeof d === 'object' && 'similar' in d && Array.isArray((d as SimilarItemsDetail).similar)) {
    return d as SimilarItemsDetail;
  }
  return null;
}

/** A sentence for the screen. Never shows raw server internals. */
export function describeError(err: unknown): string {
  if (err instanceof InventoryApiError) {
    if (err.status === 403) return 'That coordinator key was not accepted.';
    if (err.status === 404) return 'That place or item was not found.';
    if (err.status === 409) {
      return typeof err.detail === 'string' ? err.detail : 'That conflicts with something that already exists.';
    }
    if (err.status === 422) return 'Please check what you entered and try again.';
    if (err.status === 429) return 'Too many requests. Please wait a moment and try again.';
    return 'Something went wrong on our side. Please try again.';
  }
  return 'We could not reach the server. Please check your connection and try again.';
}

// ---------- community ----------

export const getCatalog = (): Promise<CatalogItem[]> => call('/catalog');
export const getPlaces = (): Promise<PlaceSummary[]> => call('/locations');
export const getPlace = (id: string): Promise<PlaceDetailData> => call(`/locations/${encodeURIComponent(id)}`);
export const getMatches = (id: string): Promise<MatchView[]> => call(`/locations/${encodeURIComponent(id)}/matches`);
export const getDemand = (id: string): Promise<DemandView[]> => call(`/locations/${encodeURIComponent(id)}/demand`);
export const postEntry = (body: PostEntryBody): Promise<EntryResult> => call('/entries', { method: 'POST', body });

// ---------- coordinator ----------

export const getAliases = (key: string, status?: string): Promise<AliasView[]> =>
  call(`/admin/aliases${status ? `?status=${encodeURIComponent(status)}` : ''}`, { key });
export const getHeld = (key: string): Promise<UnresolvedView[]> => call('/admin/unresolved', { key });
export const getGuesses = (key: string): Promise<GuessView[]> => call('/admin/guesses', { key });

export const resolveEntry = (key: string, entryId: string, itemId: string, aliasText?: string): Promise<unknown> =>
  call(`/admin/entries/${encodeURIComponent(entryId)}/resolve`, {
    method: 'POST',
    key,
    body: { item_id: itemId, ...(aliasText?.trim() ? { alias_text: aliasText.trim() } : {}) },
  });

export const promoteEntry = (
  key: string,
  entryId: string,
  body: { name: string; alias_text?: string; confirm_new?: boolean },
): Promise<unknown> => call(`/admin/entries/${encodeURIComponent(entryId)}/promote`, { method: 'POST', key, body });

export const handoffEntry = (
  key: string,
  entryId: string,
  body: { quantity: number; to_need_id?: string },
): Promise<HandoffView> => call(`/admin/entries/${encodeURIComponent(entryId)}/handoff`, { method: 'POST', key, body });

export const getHandoffs = (key: string): Promise<HandoffView[]> => call('/admin/handoffs', { key });

export const closeEntry = (key: string, entryId: string): Promise<void> =>
  call(`/admin/entries/${encodeURIComponent(entryId)}/close`, { method: 'POST', key });

export const createAlias = (key: string, text: string, itemId: string): Promise<AliasView> =>
  call('/admin/aliases', { method: 'POST', key, body: { text, item_id: itemId } });

export const updateAlias = (
  key: string,
  aliasId: string,
  patch: { text?: string; item_id?: string; status?: 'approved' | 'rejected' },
): Promise<AliasView> => call(`/admin/aliases/${encodeURIComponent(aliasId)}`, { method: 'PATCH', key, body: patch });

export const createItem = (
  key: string,
  body: { name: string; aliases?: string[]; confirm_new?: boolean },
): Promise<ItemRef> => call('/admin/items', { method: 'POST', key, body });

export const renameItem = (key: string, itemId: string, name: string): Promise<ItemRef> =>
  call(`/admin/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', key, body: { name } });

export const KIND_LABEL: Record<EntryKind, string> = { have: 'Has', need: 'Needs', offer: 'Offered' };
