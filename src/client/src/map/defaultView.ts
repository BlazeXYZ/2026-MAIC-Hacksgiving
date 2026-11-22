import type { LatLngTuple } from 'leaflet';

/**
 * Downtown Milwaukee (City Hall).
 * Leaflet leaves an unset map on the Gulf of Guinea, so every map must set this.
 */
export const MILWAUKEE_CENTER: LatLngTuple = [43.0389, -87.9065];

/** Street-level zoom used for the first paint and the Recenter control. */
export const MILWAUKEE_DEFAULT_ZOOM = 14;
