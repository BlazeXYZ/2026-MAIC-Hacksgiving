import type { LatLngTuple } from 'leaflet';

export type SectorStatus = 'Unsearched' | 'Searching' | 'Cleared' | 'Lead Found';

export interface SearchSector {
  id: string;
  name: string;
  status: SectorStatus;
  coordinates: LatLngTuple[]; // 5 points (closed polygon)
  center: LatLngTuple;
  volunteers: string[];
  notes?: string;
  updatedAt: string;
}

export const STATUS_COLORS: Record<SectorStatus, { fill: string; border: string; badgeBg: string; text: string }> = {
  Unsearched: {
    fill: '#94a3b8',
    border: '#64748b',
    badgeBg: '#f1f5f9',
    text: '#475569',
  },
  Searching: {
    fill: '#eab308',
    border: '#ca8a04',
    badgeBg: '#fef9c3',
    text: '#854d0e',
  },
  Cleared: {
    fill: '#16a34a',
    border: '#15803d',
    badgeBg: '#dcfce7',
    text: '#166534',
  },
  'Lead Found': {
    fill: '#2563eb',
    border: '#1d4ed8',
    badgeBg: '#dbeafe',
    text: '#1e40af',
  },
};

// 4x4 Grid around 27th & Wisconsin Ave in Milwaukee (43.0389, -87.9480)
const BASE_LAT = 43.044;
const BASE_LON = -87.958;
const STEP_LAT = 0.0035; // ~3.5 blocks north/south
const STEP_LON = 0.0050; // ~4 blocks east/west

const ROWS = ['A', 'B', 'C', 'D'];
const COLS = [1, 2, 3, 4];

export function generateInitialSectors(): SearchSector[] {
  const sectors: SearchSector[] = [];

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

      if (id === 'B2') {
        status = 'Cleared';
        volunteers = ['Lantern', 'Maple'];
        notes = 'Alleys and storefront entries checked. Nothing noted.';
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
      });
    }
  }

  return sectors;
}
