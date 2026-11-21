/**
 * Real places a resident can pick from in the "Ask for help" flow.
 * Each need maps to a list built from the pantry and safe-place APIs, with sample data when the server is down.
 */

import { COMFORCE_HOTLINE } from '../components/shell/EmergencyBar';
import { fetchPantries, SAMPLE_PANTRIES } from './pantries';
import { fetchSafePlaces, SAMPLE_SAFE_PLACES } from './safePlaces';

export type NeedId = 'food' | 'ride' | 'safe-place' | 'warm-lobby' | 'talk' | 'other';

export interface HelpOption {
  id: string;
  kind: 'pantry' | 'safe-place' | 'hotline';
  name: string;
  address: string;
  phone: string | null;
  hours: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  /** Only pantries report this. */
  openNow?: boolean;
  noIdRequired: boolean;
  staffed: boolean;
}

export interface HelpOptionsResult {
  options: HelpOption[];
  /** True when any list came from built-in sample data instead of the server. */
  sample: boolean;
}

export interface Origin {
  latitude: number;
  longitude: number;
  label: string;
}

/** Used until the resident shares a location. Their real position never leaves the device. */
export const DEFAULT_ORIGIN: Origin = { latitude: 43.0445, longitude: -87.9087, label: 'downtown Milwaukee' };

const HOTLINE: HelpOption = {
  id: 'comforce-hotline',
  kind: 'hotline',
  name: 'ComForce 24/7 hotline',
  address: 'By phone, from anywhere',
  phone: COMFORCE_HOTLINE.display,
  hours: 'Open around the clock.',
  district: 'Citywide',
  latitude: null,
  longitude: null,
  noIdRequired: true,
  staffed: true,
};

async function pantryOptions(signal?: AbortSignal): Promise<{ list: HelpOption[]; sample: boolean }> {
  let sample = false;
  let pantries = SAMPLE_PANTRIES as readonly Awaited<ReturnType<typeof fetchPantries>>[number][];
  try {
    pantries = await fetchPantries(undefined, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    sample = true;
  }
  const list = pantries.map<HelpOption>((p) => ({
    id: p.id,
    kind: 'pantry',
    name: p.name,
    address: p.address,
    phone: p.phone ?? null,
    hours: p.hours_description,
    district: p.district,
    latitude: p.latitude,
    longitude: p.longitude,
    openNow: p.open_now,
    noIdRequired: p.no_id_required,
    staffed: p.is_staffed,
  }));
  return { list, sample };
}

async function safePlaceOptions(signal?: AbortSignal): Promise<{ list: HelpOption[]; sample: boolean; categories: Map<string, string> }> {
  let sample = false;
  let places = SAMPLE_SAFE_PLACES as readonly Awaited<ReturnType<typeof fetchSafePlaces>>[number][];
  try {
    places = await fetchSafePlaces(signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    sample = true;
  }
  const categories = new Map(places.map((p) => [p.id, p.category]));
  const list = places.map<HelpOption>((p) => ({
    id: p.id,
    kind: 'safe-place',
    name: p.name,
    address: p.address,
    phone: p.phone ?? null,
    hours: p.hours_description,
    district: p.district,
    latitude: p.latitude,
    longitude: p.longitude,
    noIdRequired: p.no_id_required,
    staffed: p.is_staffed,
  }));
  return { list, sample, categories };
}

/** Loads the choices for one need. `other` has no list. */
export async function loadHelpOptions(need: NeedId, signal?: AbortSignal): Promise<HelpOptionsResult> {
  switch (need) {
    case 'food': {
      const { list, sample } = await pantryOptions(signal);
      return { options: list, sample };
    }
    case 'safe-place': {
      const { list, sample } = await safePlaceOptions(signal);
      return { options: list, sample };
    }
    case 'warm-lobby': {
      // Public lobbies and campus desks, not crisis shelters. Falls back to every place if that leaves none.
      const { list, sample, categories } = await safePlaceOptions(signal);
      const lobbies = list.filter((o) => categories.get(o.id) !== 'shelter');
      return { options: lobbies.length ? lobbies : list, sample };
    }
    case 'talk': {
      const { list, sample } = await safePlaceOptions(signal);
      return { options: [HOTLINE, ...list.filter((o) => o.staffed && o.phone)], sample };
    }
    case 'ride': {
      // A ride needs a destination: any pantry or safe place.
      const [pantries, places] = await Promise.all([pantryOptions(signal), safePlaceOptions(signal)]);
      return { options: [...pantries.list, ...places.list], sample: pantries.sample || places.sample };
    }
    default:
      return { options: [], sample: false };
  }
}

/** Straight-line miles between two points (haversine). */
export function distanceMiles(from: Origin, to: Pick<HelpOption, 'latitude' | 'longitude'>): number | null {
  if (to.latitude === null || to.longitude === null) return null;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface RankedOption {
  option: HelpOption;
  miles: number | null;
}

/** The hotline stays first. Places that are closed right now drop to the bottom, then nearest first. */
export function rankOptions(options: readonly HelpOption[], origin: Origin): RankedOption[] {
  const ranked = options.map((option) => ({ option, miles: distanceMiles(origin, option) }));
  const rank = (r: RankedOption): number => (r.option.kind === 'hotline' ? 0 : r.option.openNow === false ? 2 : 1);
  return ranked.sort((a, b) => rank(a) - rank(b) || (a.miles ?? Infinity) - (b.miles ?? Infinity));
}

/** Short label that fits the server's 80-character limit on one selected option. */
export function requestedLabel(option: HelpOption): string {
  return `Requested: ${option.name}`.slice(0, 80);
}
