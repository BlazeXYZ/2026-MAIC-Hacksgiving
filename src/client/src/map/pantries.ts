/** Verified emergency food pantries for the community map (issue #13). */

import type { Pantry } from '../contracts/resources';

export type { Pantry };

export const PANTRIES_PATH = '/api/v1/resources/pantries';

/**
 * Seed pantries matching backend seeds with synthetic 555 numbers.
 * Used for offline fallback or demo rendering.
 */
export const SAMPLE_PANTRIES: readonly Pantry[] = [
  {
    id: 'hunger-task-force-south',
    name: 'Hunger Task Force Southside Community Resource Center',
    category: 'food',
    address: '802 W Mitchell St, Milwaukee, WI 53204',
    latitude: 43.01215,
    longitude: -87.9224,
    phone: '414-555-0110',
    hours_description: 'Monday–Friday 9am–5pm.',
    is_staffed: true,
    no_id_required: true,
    district: 'Near South Side',
    accessibility_notes: 'Street-level entrance. Walk-ins welcome without photo ID. Confirm hours before visiting.',
    open_now: true,
  },
  {
    id: 'house-of-peace',
    name: 'House of Peace Food Pantry',
    category: 'food',
    address: '1702 W Walnut St, Milwaukee, WI 53205',
    latitude: 43.0522,
    longitude: -87.9334,
    phone: '414-555-0111',
    hours_description: 'Wednesday and Friday 10am–2pm.',
    is_staffed: true,
    no_id_required: false,
    district: 'Haymarket',
    accessibility_notes: 'Ask at the desk about what to bring. Walk-ins welcome during distribution hours.',
    open_now: false,
  },
  {
    id: 'friedens-community-pantry',
    name: 'Friedens Community Food Pantry',
    category: 'food',
    address: '1220 W Vliet St, Milwaukee, WI 53205',
    latitude: 43.0487,
    longitude: -87.9272,
    phone: '414-555-0112',
    hours_description: 'Tuesday & Thursday 9:30am–12pm.',
    is_staffed: true,
    no_id_required: true,
    district: 'Near West Side',
    accessibility_notes: 'Ramp access on north entrance. No photo ID required for emergency pantry packages.',
    open_now: true,
  },
];

function isPantry(value: unknown): value is Pantry {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string'
    && typeof p.name === 'string'
    && typeof p.address === 'string'
    && typeof p.hours_description === 'string'
    && typeof p.accessibility_notes === 'string'
    && typeof p.is_staffed === 'boolean'
    && typeof p.no_id_required === 'boolean'
    && typeof p.open_now === 'boolean'
    && Number.isFinite(p.latitude)
    && Number.isFinite(p.longitude)
  );
}

export interface FetchPantriesOptions {
  openNow?: boolean;
  noIdRequired?: boolean;
  district?: string;
}

/** Fetch emergency food pantries with filter options. */
export async function fetchPantries(
  options?: FetchPantriesOptions,
  signal?: AbortSignal,
): Promise<Pantry[]> {
  const params = new URLSearchParams();
  if (options?.openNow !== undefined) {
    params.set('open_now', String(options.openNow));
  }
  if (options?.noIdRequired !== undefined) {
    params.set('no_id_required', String(options.noIdRequired));
  }
  if (options?.district) {
    params.set('district', options.district);
  }

  const query = params.toString();
  const url = query ? `${PANTRIES_PATH}?${query}` : PANTRIES_PATH;

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Pantries request failed with ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isPantry)) {
    throw new Error('Pantries response did not match the Pantry contract');
  }
  return body;
}
