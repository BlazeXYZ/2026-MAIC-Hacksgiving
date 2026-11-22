import type { LatLngTuple } from 'leaflet';
import { STALE_AFTER_HOURS } from './searchCoverage';

// 'Stale' is never stored: it is derived from a Cleared sector whose last pass is
// older than STALE_AFTER_HOURS (see resolveStatus in searchCoverage.ts).
export type SectorStatus = 'Unsearched' | 'Searching' | 'Cleared' | 'Stale' | 'Lead Found';

export interface SearchSector {
  id: string;
  name: string;
  status: SectorStatus;
  coordinates: LatLngTuple[]; // 5 points (closed polygon)
  center: LatLngTuple;
  volunteers: string[];
  notes?: string;
  updatedAt: string;
  lastSearchedAt: string | null; // ISO time of the most recent completed (Cleared) pass
  passCount: number; // completed passes over this sector
}

// Hex literals mirror the design tokens in src/client/src/styles/global.css
// (Leaflet sets SVG fill/stroke attributes, which cannot resolve CSS var()).
export const STATUS_COLORS: Record<SectorStatus, { fill: string; border: string; badgeBg: string; text: string }> = {
  Unsearched: {
    fill: '#B5C1B0', // --line-2
    border: '#6C776F', // --ink-3
    badgeBg: '#E4EAE0', // --sunk
    text: '#45524A', // --ink-2
  },
  Searching: {
    fill: '#B7790B', // --amber
    border: '#6E4A06', // --amber-ink
    badgeBg: '#FBF1DA', // --amber-wash
    text: '#6E4A06', // --amber-ink
  },
  Cleared: {
    fill: '#0F6B3A', // --green
    border: '#174A2C', // --green-ink
    badgeBg: '#E4F0E6', // --green-wash
    text: '#174A2C', // --green-ink
  },
  Stale: {
    fill: '#B4532A', // --stale
    border: '#7A3414', // --stale-ink
    badgeBg: '#FBEAE1', // --stale-wash
    text: '#7A3414', // --stale-ink (7.7:1 on --stale-wash)
  },
  'Lead Found': {
    fill: '#4338A8', // --police
    border: '#3730A3', // darker police
    badgeBg: '#ECEAFA', // --police-wash
    text: '#3730A3',
  },
};

// 4x4 Grid around 27th & Wisconsin Ave in Milwaukee (43.0389, -87.9480)
const BASE_LAT = 43.044;
const BASE_LON = -87.958;
const STEP_LAT = 0.0035; // ~3.5 blocks north/south
const STEP_LON = 0.0050; // ~4 blocks east/west

const ROWS = ['A', 'B', 'C', 'D'];
const COLS = [1, 2, 3, 4];

const MINUTE_MS = 60 * 1000;

export function generateInitialSectors(nowMs: number = Date.now()): SearchSector[] {
  const sectors: SearchSector[] = [];
  const minutesAgo = (m: number): string => new Date(nowMs - m * MINUTE_MS).toISOString();

  for (let r = 0; r < ROWS.length; r++) {
    const rowName = ROWS[r];
    const south = BASE_LAT - (r + 1) * STEP_LAT;
    const north = BASE_LAT - r * STEP_LAT;

    for (let c = 0; c < COLS.length; c++) {
      const colNum = COLS[c];
      const west = BASE_LON + c * STEP_LON;
      const east = BASE_LON + (c + 1) * STEP_LON;

      const id = `${rowName}${colNum}`;

      let status: SectorStatus = 'Unsearched';
      let volunteers: string[] = [];
      let notes = '';
      let passCount = 0;
      let lastSearchedAt: string | null = null;

      if (id === 'B2') {
        status = 'Cleared';
        volunteers = ['Lantern', 'Maple'];
        notes = 'Alleys and storefront entries checked. Nothing noted.';
        passCount = 1;
        lastSearchedAt = minutesAgo(40);
      } else if (id === 'B3') {
        status = 'Searching';
        volunteers = ['Cedar', 'Harbor'];
        notes = 'Active foot search along Wisconsin Ave.';
      } else if (id === 'C2') {
        status = 'Lead Found';
        volunteers = ['Brook'];
        notes = 'Witness report: navy jacket spotted near transit shelter.';
      } else if (id === 'C3') {
        status = 'Searching';
        volunteers = ['Willow'];
      } else if (id === 'A2') {
        status = 'Searching';
        volunteers = ['Juniper'];
      } else if (id === 'A1') {
        status = 'Cleared';
        volunteers = ['Sparrow', 'Cedar'];
        notes = 'Park paths and parking lots checked. Nothing noted.';
        // Demo: cleared long enough ago that it shows as Stale.
        passCount = 1;
        lastSearchedAt = minutesAgo(STALE_AFTER_HOURS * 60 + 75);
      } else if (id === 'B1') {
        status = 'Cleared';
        volunteers = ['Harbor'];
        notes = 'Residential blocks walked twice. Neighbors asked to check garages.';
        // Demo: multi-pass sector.
        passCount = 2;
        lastSearchedAt = minutesAgo(25);
      } else if (id === 'C1') {
        status = 'Searching';
        volunteers = ['Maple', 'Brook'];
        notes = 'Team checking bus stops and the corner market.';
      } else if (id === 'A3') {
        status = 'Cleared';
        volunteers = ['Willow'];
        notes = 'Wisconsin Ave storefronts and side streets cleared.';
        // Demo: turns Stale about one minute after the page loads.
        passCount = 1;
        lastSearchedAt = minutesAgo(STALE_AFTER_HOURS * 60 - 1);
      }

      const coordinates: LatLngTuple[] = [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
        [south, west], // close ring
      ];

      const center: LatLngTuple = [(south + north) / 2, (west + east) / 2];

      sectors.push({
        id,
        name: `Sector ${id}`,
        status,
        coordinates,
        center,
        volunteers,
        notes,
        updatedAt: 'Just now',
        lastSearchedAt,
        passCount,
      });
    }
  }

  return sectors;
}
