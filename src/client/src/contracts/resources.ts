/**
 * Community resource contracts.
 * Keep these field names aligned with `src/server/resources/schema.py`.
 * GeoJSON positions are [longitude, latitude].
 */

export interface CommunityResource {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  hours_description: string;
  is_staffed: boolean;
  no_id_required: boolean;
}

export interface SafePlace extends CommunityResource {
  district: string;
}

export interface Pantry extends CommunityResource {
  district: string;
  accessibility_notes: string;
  open_now: boolean;
}
