import type { LatLngTuple } from 'leaflet';

export interface RouteCheckpoint {
  id: string;
  name: string;
  address: string;
  position: LatLngTuple;
  instructions: string;
  isDestination?: boolean;
  isStart?: boolean;
}

export const DIERCKS_HALL_COORDS: LatLngTuple = [43.04535, -87.90655];
export const CAMPUS_CENTER_COORDS: LatLngTuple = [43.04440, -87.90705];
export const PUBLIC_SAFETY_COORDS: LatLngTuple = [43.04385, -87.90745];

export const DEFAULT_CAMPUS_CORRIDOR: LatLngTuple[] = [
  DIERCKS_HALL_COORDS,
  CAMPUS_CENTER_COORDS,
  PUBLIC_SAFETY_COORDS,
];

export const CORRIDOR_CHECKPOINTS: RouteCheckpoint[] = [
  {
    id: 'corridor-start-diercks',
    name: 'Diercks Hall Atrium (Route Start)',
    address: '1025 N Milwaukee St, Milwaukee, WI 53202',
    position: DIERCKS_HALL_COORDS,
    instructions: 'Leave through the lit atrium at Diercks Hall. Stay on the campus walkway heading south toward Broadway.',
    isStart: true,
  },
  {
    id: 'corridor-dest-safety',
    name: 'MSOE Public Safety (Verified Safe Haven)',
    address: '1025 N Broadway, Milwaukee, WI 53202',
    position: PUBLIC_SAFETY_COORDS,
    instructions: '24/7 staffed campus safety desk located at the end of the lit corridor. Press door button for immediate entry.',
    isDestination: true,
  },
];

export async function fetchCampusCorridor(signal?: AbortSignal): Promise<LatLngTuple[]> {
  try {
    const url = '/api/v1/routes/safe-walk?origin_lat=43.04535&origin_lon=-87.90655&destination=msoe_safety';
    const response = await fetch(url, { signal });
    if (!response.ok) return DEFAULT_CAMPUS_CORRIDOR;
    const data = await response.json();
    if (data?.geometry?.coordinates && Array.isArray(data.geometry.coordinates)) {
      // GeoJSON is [lon, lat], convert to Leaflet [lat, lon]
      return data.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as LatLngTuple);
    }
  } catch {
    // Offline or fallback to default lit corridor
  }
  return DEFAULT_CAMPUS_CORRIDOR;
}
