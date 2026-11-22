import type { LatLngTuple } from 'leaflet';

/**
 * ISRID (International Search & Rescue Incident Database) distance rings.
 *
 * Each figure is the horizontal distance from the Initial Planning Point (IPP,
 * here the last-known point) within which 25 / 50 / 75 / 95 % of subjects in
 * that category were found. Every number below is copied from the table named
 * in its `source`, and nothing is entered from memory. A category that has no
 * public source we could verify is marked `placeholder: true` and the UI says so.
 *
 * Important caveat (shown in the UI next to the rings): ISRID is mostly
 * wilderness and rural data. Urban cases, especially teens who can use
 * transit, may not follow these rings.
 */

export type RingPercentile = 25 | 50 | 75 | 95;

export const RING_PERCENTILES: readonly RingPercentile[] = [25, 50, 75, 95];

export type IsridEnvironment = 'Urban' | 'Temperate';

export interface IsridSource {
  citation: string;
  url: string;
  /** Table / page and column the numbers come from. */
  location: string;
}

export interface IsridDistances {
  /** Distance in kilometers, keyed by percentile. */
  km: Record<RingPercentile, number>;
  /** Number of cases behind the figures (null for placeholders). */
  n: number | null;
  source: IsridSource | null;
  /** Shown under the legend, e.g. when one setting borrows another setting's figures. */
  note?: string;
}

/** A sourced, category-specific search tip shown with the rings. */
export interface IsridTip {
  text: string;
  source: IsridSource;
}

export interface IsridCategory {
  id: string;
  label: string;
  placeholder: boolean;
  environments: Record<IsridEnvironment, IsridDistances>;
  tip?: IsridTip;
}

const KM_PER_MILE = 1.609344;

/** Convert a row published in miles to km (1 decimal), so the source's own numbers stay visible below. */
function milesToKm(miles: Record<RingPercentile, number>): Record<RingPercentile, number> {
  const round = (mi: number): number => Math.round(mi * KM_PER_MILE * 10) / 10;
  return { 25: round(miles[25]), 50: round(miles[50]), 75: round(miles[75]), 95: round(miles[95]) };
}

const KOESTER_LPB_DEMENTIA: Omit<IsridSource, 'location'> = {
  citation:
    'Koester, R. J. (2008). Lost Person Behavior: A Search and Rescue Guide on Where to Look for Land, Air, and Water. dbS Productions. "Dementia (Alzheimer\'s)" chapter, p. 164 (free sample chapter published by dbS Productions).',
  url: 'https://www.dbs-sar.com/LPB/Dementia.pdf',
};

const KOESTER_2020_ASD_TD: Omit<IsridSource, 'location'> = {
  citation:
    'Koester, R. J. (2020). Enhancements to Statistical Probability of Area Models based upon updated ISRID data collection for Autistic Spectrum Disorders and Typically Developing Children. Journal of Search & Rescue, 4(1). Table 3.',
  url: 'https://journalofsar.com/wp-content/uploads/2020/04/v4-8-Koester-ASD-vTD.pdf.pdf',
};

const IGT4SAR_KOESTER: Omit<IsridSource, 'location'> = {
  citation:
    'Koester, R. J. (2008). Lost Person Behavior. dbS Productions. Distance tables as reproduced in Ferguson, D. IGT4SAR (Integrated Geospatial Tools for Search and Rescue), IPP_EuclideanDistance2.py, whose header states the IPP distances are provided by Robert Koester.',
  url: 'https://github.com/dferguso/IGT4SAR/blob/master/IPP_EuclideanDistance2.py',
};

const IGT4SAR_TEEN_LOCATION =
  '"Child (13-15)", Temperate / flat row: 0.4 / 0.8 / 2.0 / 6.2 miles, converted to km';

export const ISRID_CATEGORIES: IsridCategory[] = [
  {
    id: 'child',
    label: 'Child (age 1-16)',
    placeholder: false,
    environments: {
      Urban: {
        km: { 25: 0.2, 50: 0.5, 75: 1.6, 95: 5.2 },
        n: 129,
        source: { ...KOESTER_2020_ASD_TD, location: 'Table 3, "Distance (horizontal) from IPP (km)", TD Child (1-16), Urban column' },
      },
      Temperate: {
        km: { 25: 0.3, 50: 0.9, 75: 2.4, 95: 11.3 },
        n: 903,
        source: { ...KOESTER_2020_ASD_TD, location: 'Table 3, "Distance (horizontal) from IPP (km)", TD Child (1-16), Temperate column' },
      },
    },
  },
  {
    id: 'autism',
    label: 'Autism spectrum',
    placeholder: false,
    environments: {
      Urban: {
        km: { 25: 0.4, 50: 1.0, 75: 2.1, 95: 6.4 },
        n: 31,
        source: { ...KOESTER_2020_ASD_TD, location: 'Table 3, "Distance (horizontal) from IPP (km)", ASD, Urban column' },
      },
      Temperate: {
        km: { 25: 0.4, 50: 0.9, 75: 2.3, 95: 8.0 },
        n: 233,
        source: { ...KOESTER_2020_ASD_TD, location: 'Table 3, "Distance (horizontal) from IPP (km)", ASD, Temperate column' },
      },
    },
  },
  {
    id: 'dementia',
    label: 'Dementia (Alzheimer\'s)',
    placeholder: false,
    environments: {
      Urban: {
        km: { 25: 0.3, 50: 1.1, 75: 3.2, 95: 12.6 },
        n: 336,
        source: { ...KOESTER_LPB_DEMENTIA, location: 'p. 164, "Distance (horizontal) from the IPP (kilometers)", Urban column' },
      },
      Temperate: {
        km: { 25: 0.3, 50: 1.0, 75: 2.4, 95: 12.8 },
        n: 175,
        source: { ...KOESTER_LPB_DEMENTIA, location: 'p. 164, "Distance (horizontal) from the IPP (kilometers)", Temperate / Flat column' },
      },
    },
  },
  {
    // ISRID's adolescent group is "Child (13-15)". We could not get the book's
    // table directly, so these come from IGT4SAR, an open-source SAR toolbox
    // whose ring script reproduces Koester's (2008) distance tables in miles.
    // Spot check: its Dementia rows match the book's free Dementia chapter
    // (Urban 0.2/0.7/2.0/7.8 mi = 0.3/1.1/3.2/12.6 km). It has no Urban row for
    // 13-15 (it falls back to the Temperate/flat row), and no case counts.
    id: 'teen',
    label: 'Teen (age 13-15)',
    placeholder: false,
    environments: {
      Urban: {
        km: milesToKm({ 25: 0.4, 50: 0.8, 75: 2.0, 95: 6.2 }),
        n: null,
        source: { ...IGT4SAR_KOESTER, location: `${IGT4SAR_TEEN_LOCATION} (no Urban row; Temperate / flat shown)` },
        note: 'No urban figures are published for ages 13-15, so these are the Temperate (flat terrain) rings.',
      },
      Temperate: {
        km: milesToKm({ 25: 0.4, 50: 0.8, 75: 2.0, 95: 6.2 }),
        n: null,
        source: { ...IGT4SAR_KOESTER, location: IGT4SAR_TEEN_LOCATION },
      },
    },
    tip: {
      text: 'In urban and suburban searches, 80% of missing 13-15 year olds were found in a structure. Check buildings, not just streets.',
      source: {
        citation: 'NEWSAR SAR Field Team Member training, Unit 3: Lost Person Behavior (2020), "Check Structures (Urban)", citing ISRID.',
        url: 'http://aa3sd.net/newsar/sar_ftm_v1_0_0/presentations/speakers_notes/3_lost_person_behavior_notes.pdf',
        location: 'slide 23',
      },
    },
  },
];

export const DEFAULT_ISRID_CATEGORY_ID = 'child';
export const DEFAULT_ISRID_ENVIRONMENT: IsridEnvironment = 'Urban';

// Hex literals mirror the design tokens in src/client/src/styles/global.css
// (Leaflet sets SVG stroke attributes, which cannot resolve CSS var()).
export const RING_COLORS: Record<RingPercentile, string> = {
  25: '#A61D19', // --red-deep
  50: '#D8322B', // --red
  75: '#B7790B', // --amber
  95: '#6C776F', // --ink-3
};

export function getIsridCategory(id: string): IsridCategory {
  return ISRID_CATEGORIES.find((c) => c.id === id) ?? ISRID_CATEGORIES[0];
}

/** Great-circle distance in kilometers (haversine). */
export function distanceKm(a: LatLngTuple, b: LatLngTuple): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Smallest ring percentile that contains the given distance, or null if beyond 95%. */
export function ringForDistance(km: number, distances: IsridDistances): RingPercentile | null {
  for (const p of RING_PERCENTILES) {
    if (km <= distances.km[p]) return p;
  }
  return null;
}
