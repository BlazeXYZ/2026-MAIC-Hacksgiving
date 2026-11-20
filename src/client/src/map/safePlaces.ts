/**
 * Verified safe places for the resident map (issue #12).
 *
 * `SafePlace` mirrors the contract in `src/server/resource_schema.py` and
 * `src/client/src/contracts.ts` (PR #51). Once that PR merges, import the type
 * from `../contracts` instead of redeclaring it here.
 */

export interface SafePlace {
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
  district: string;
}

export const SAFE_PLACES_PATH = '/api/v1/resources/safe-places';

/**
 * Shown until the API responds, and whenever it is unreachable, so the map
 * still works in offline demos. Phone numbers are synthetic 555 numbers; the
 * real hotlines come from the API.
 */
export const SAMPLE_SAFE_PLACES: readonly SafePlace[] = [
  {
    id: 'sojourner',
    name: 'Sojourner Family Peace Center',
    category: 'shelter',
    address: '619 W Walnut St, Milwaukee, WI 53212',
    latitude: 43.052153,
    longitude: -87.919154,
    phone: '414-555-0101',
    hours_description: '24/7 crisis line. Office Monday–Thursday 8am–6pm, Friday 8am–5pm.',
    is_staffed: true,
    no_id_required: true,
    district: 'Haymarket',
  },
  {
    id: 'msoe_safety',
    name: 'MSOE Public Safety',
    category: 'public_safety',
    address: '1025 N Broadway, Milwaukee, WI 53202',
    latitude: 43.04385,
    longitude: -87.90745,
    phone: '414-555-0102',
    hours_description: 'Staffed campus safety desk.',
    is_staffed: true,
    no_id_required: true,
    district: 'MSOE Campus',
  },
  {
    id: 'womens_center',
    name: "Milwaukee Women's Center",
    category: 'shelter',
    address: '3025 W Mitchell St, Milwaukee, WI 53215',
    latitude: 43.01221,
    longitude: -87.95241,
    phone: '414-555-0103',
    hours_description: 'Listed as open around the clock.',
    is_staffed: true,
    no_id_required: true,
    district: 'Near South Side',
  },
  {
    id: 'king_library',
    name: 'King Library Safe Haven',
    category: 'safe_place',
    address: '310 W Locust St, Milwaukee, WI 53212',
    latitude: 43.0565,
    longitude: -87.9138,
    phone: null,
    hours_description: 'Public library lobby during posted library hours. Not a crisis desk.',
    is_staffed: false,
    no_id_required: true,
    district: 'Haymarket',
  },
];

function isSafePlace(value: unknown): value is SafePlace {
  if (typeof value !== 'object' || value === null) return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === 'string'
    && typeof place.name === 'string'
    && typeof place.address === 'string'
    && typeof place.hours_description === 'string'
    && typeof place.is_staffed === 'boolean'
    && Number.isFinite(place.latitude)
    && Number.isFinite(place.longitude)
  );
}

/** Fetch verified safe places. Rejects when the API is down or returns an unexpected shape. */
export async function fetchSafePlaces(signal?: AbortSignal): Promise<SafePlace[]> {
  const response = await fetch(SAFE_PLACES_PATH, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Safe places request failed with ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isSafePlace)) {
    throw new Error('Safe places response did not match the SafePlace contract');
  }
  return body;
}

/** `tel:` link with formatting stripped, e.g. `tel:4145550101`. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Walking directions to the place on OpenStreetMap; the start point is left for the user to choose. */
export function directionsHref(place: Pick<SafePlace, 'latitude' | 'longitude'>): string {
  const route = encodeURIComponent(`;${place.latitude},${place.longitude}`);
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${route}`;
}
