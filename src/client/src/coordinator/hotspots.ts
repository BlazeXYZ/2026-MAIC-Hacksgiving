import type { LatLngTuple } from 'leaflet';

export interface HotspotFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // GeoJSON is [[[lon, lat], ...]]
  };
  properties: {
    count: number;
    density: number; // 0.0 to 1.0
  };
}

export interface HotspotCollection {
  type: 'FeatureCollection';
  features: HotspotFeature[];
}

export const COORDINATOR_HOTSPOTS_PATH = '/api/v1/coordinator/hotspots';

// Pre-computed fallback demo hotspots derived from 27th & Wisconsin cluster
export const DEMO_HOTSPOT_COLLECTION: HotspotCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-87.905, 43.035],
            [-87.900, 43.035],
            [-87.900, 43.040],
            [-87.905, 43.040],
            [-87.905, 43.035],
          ],
        ],
      },
      properties: { count: 12, density: 1.0 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-87.910, 43.035],
            [-87.905, 43.035],
            [-87.905, 43.040],
            [-87.910, 43.040],
            [-87.910, 43.035],
          ],
        ],
      },
      properties: { count: 6, density: 0.5 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-87.905, 43.040],
            [-87.900, 43.040],
            [-87.900, 43.045],
            [-87.905, 43.045],
            [-87.905, 43.040],
          ],
        ],
      },
      properties: { count: 8, density: 0.67 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-87.920, 43.045],
            [-87.915, 43.045],
            [-87.915, 43.050],
            [-87.920, 43.050],
            [-87.920, 43.045],
          ],
        ],
      },
      properties: { count: 3, density: 0.25 },
    },
  ],
};

export function densityColor(density: number): string {
  if (density >= 0.75) return '#dc2626'; // High (crimson)
  if (density >= 0.4) return '#ea580c';  // Medium (orange)
  return '#eab308';                      // Low (amber)
}

export function polygonToLatLngTuples(polygonCoords: number[][][]): LatLngTuple[] {
  // GeoJSON coordinate ring is [lon, lat], Leaflet is [lat, lon]
  if (!polygonCoords || polygonCoords.length === 0) return [];
  return polygonCoords[0].map(([lon, lat]) => [lat, lon] as LatLngTuple);
}

export async function fetchCoordinatorHotspots(
  apiKey = 'dev-coordinator-key',
  signal?: AbortSignal,
): Promise<HotspotCollection> {
  try {
    const response = await fetch(COORDINATOR_HOTSPOTS_PATH, {
      signal,
      headers: {
        Accept: 'application/json',
        'X-Coordinator-Key': apiKey,
      },
    });
    if (!response.ok) return DEMO_HOTSPOT_COLLECTION;
    const data = await response.json();
    if (data?.features && Array.isArray(data.features)) {
      return data as HotspotCollection;
    }
  } catch {
    // Offline or fallback to demo points
  }
  return DEMO_HOTSPOT_COLLECTION;
}
