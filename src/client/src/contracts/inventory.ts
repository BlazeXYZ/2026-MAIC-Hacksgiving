/**
 * Community inventory contracts.
 * Keep these field names aligned with `src/server/api/inventory.py`.
 */

export type EntryKind = 'have' | 'need' | 'offer';

export interface ItemRef {
  id: string;
  name: string;
}

export interface CatalogItem extends ItemRef {
  aliases: string[];
}

export interface PlaceSummary {
  id: string;
  name: string;
  kind: string;
  district: string;
  address: string;
  open_needs: number;
  have: number;
  offers: number;
}

export interface EntryView {
  id: string;
  item: ItemRef;
  quantity: number;
  /** False while the match is only a system guess awaiting coordinator review. */
  verified: boolean;
  expires_at: string;
}

export interface PlaceDetailData {
  location: PlaceSummary;
  have: EntryView[];
  need: EntryView[];
  offer: EntryView[];
}

export interface PostEntryBody {
  location_id: string;
  kind: EntryKind;
  quantity: number;
  /** Exactly one of `item_id` or `text`. */
  item_id?: string;
  text?: string;
}

export interface EntryResult {
  id: string;
  status: 'matched' | 'held';
  item: ItemRef | null;
  via: string;
  verified: boolean;
  message: string;
}

export interface SourceView {
  location: string;
  location_id: string;
  kind: EntryKind;
  quantity: number;
  distance_miles: number;
}

export interface MatchView {
  need_id: string;
  item: ItemRef;
  quantity: number;
  sources: SourceView[];
}

export interface DemandView {
  entry_id: string;
  kind: 'have' | 'offer';
  item: ItemRef;
  quantity: number;
  needed_at: SourceView[];
}

export interface CandidateView {
  item: ItemRef;
  /** The decision model's probability, when it gave one. */
  probability: number | null;
}

export interface SimilarView {
  item: ItemRef;
  wording: string;
  score: number;
}

export interface UnresolvedView {
  id: string;
  location_id: string;
  kind: EntryKind;
  quantity: number;
  label: string;
  same_wording: number;
  candidates: CandidateView[];
  none_fit: number | null;
  similar: SimilarView[];
  created_at: string;
}

export interface GuessView {
  wording: string;
  item: ItemRef;
  count: number;
  via: 'fuzzy' | 'model';
  entry_id: string;
  candidates: CandidateView[];
}

export interface AliasView {
  id: string;
  text: string;
  item: ItemRef;
  status: 'seeded' | 'approved' | 'rejected' | string;
  source: string;
  open_entries: number;
}

/** Body of the 409 the server sends when a "new" item looks like an existing one. */
export interface SimilarItemsDetail {
  message: string;
  similar: SimilarView[];
}
