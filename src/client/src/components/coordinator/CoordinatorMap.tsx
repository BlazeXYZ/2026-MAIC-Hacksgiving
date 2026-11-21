import { useEffect, useRef, useState } from 'react';
import {
  latLngBounds,
  layerGroup,
  map as createMap,
  polygon,
  tileLayer,
  type Map as MapInstance,
  type LatLngTuple,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  densityColor,
  fetchCoordinatorHotspots,
  polygonToLatLngTuples,
  type HotspotCollection,
} from '../../coordinator/hotspots';
import { CoordinatorAccessError } from '../../coordinator/access';
import './CoordinatorMap.css';

const MILWAUKEE_CENTER: LatLngTuple = [43.0389, -87.9065];
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export default function CoordinatorMap({ accessKey }: { accessKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const hotspotLayerGroupRef = useRef<ReturnType<typeof layerGroup> | null>(null);

  const [hotspots, setHotspots] = useState<HotspotCollection | null>(null);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Loading incident density data…');

  useEffect(() => {
    const controller = new AbortController();
    fetchCoordinatorHotspots(accessKey, controller.signal)
      .then((collection) => {
        setHotspots(collection);
        setStatusMessage(`Loaded ${collection.features.length} hotspot density sectors.`);
      })
      .catch((error: unknown) => {
        setStatusMessage(error instanceof CoordinatorAccessError
          ? 'Coordinator access was rejected. Sign out and sign in again.'
          : 'Using local fallback hotspot sectors.');
      });

    return () => controller.abort();
  }, [accessKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = createMap(container, {
      center: MILWAUKEE_CENTER,
      zoom: 14,
      scrollWheelZoom: false,
      maxZoom: 18,
    });
    mapRef.current = map;

    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const layer = layerGroup().addTo(map);
    hotspotLayerGroupRef.current = layer;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update hotspot overlay when toggle or data changes
  useEffect(() => {
    const group = hotspotLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (!showHotspots || !hotspots || hotspots.features.length === 0) {
      return;
    }

    const allBounds: LatLngTuple[] = [];

    for (const feature of hotspots.features) {
      const ring = polygonToLatLngTuples(feature.geometry.coordinates);
      if (ring.length === 0) continue;

      allBounds.push(...ring);

      const color = densityColor(feature.properties.density);
      const poly = polygon(ring, {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.3 + feature.properties.density * 0.45,
      });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 0.85rem; color: #0f172a;">
          <strong style="color: ${color}; display: block; font-size: 0.95rem; margin-bottom: 0.25rem;">
            ⚠️ Incident Density Zone
          </strong>
          <div><strong>Police / Dispatch Calls:</strong> ${feature.properties.count}</div>
          <div><strong>Relative Density:</strong> ${(feature.properties.density * 100).toFixed(0)}%</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem;">
            Restricted coordinator intelligence for safe volunteer pairing.
          </div>
        </div>
      `;
      poly.bindPopup(popupHtml);
      poly.addTo(group);
    }

    if (allBounds.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(latLngBounds(allBounds), { padding: [30, 30], maxZoom: 15 });
    }
  }, [showHotspots, hotspots]);

  return (
    <section className="coordinator-map-wrapper" aria-labelledby="coordinator-map-heading">
      <div className="coordinator-map-header">
        <div>
          <h3 id="coordinator-map-heading">
            Coordinator Ops Map: Incident &amp; Police Density
            <span className="coordinator-map-badge">Restricted View</span>
          </h3>
          <p>Restricted dispatch intelligence. Never exposed to residents. Used for escort pairing and safe routing.</p>
        </div>

        {/* Hotspot density toggle switch */}
        <label className="coordinator-toggle-label">
          <input
            type="checkbox"
            checked={showHotspots}
            onChange={(e) => setShowHotspots(e.target.checked)}
            className="coordinator-toggle-checkbox"
            aria-label="Toggle incident and police report density overlay"
          />
          Hotspot Density Layer ({showHotspots ? 'Visible' : 'Hidden'})
        </label>
      </div>

      <div className="coordinator-map-container">
        <div
          ref={containerRef}
          className="coordinator-map-canvas"
          role="region"
          aria-label="Coordinator dispatch map showing incident hotspots"
        />
      </div>

      <div className="coordinator-map-footer">
        <ul className="coordinator-density-legend" aria-label="Density scale">
          <li>
            <span className="coordinator-density-swatch coordinator-density-swatch--high" aria-hidden="true" />
            High Density (&ge;75%)
          </li>
          <li>
            <span className="coordinator-density-swatch coordinator-density-swatch--medium" aria-hidden="true" />
            Moderate Density (40–74%)
          </li>
          <li>
            <span className="coordinator-density-swatch coordinator-density-swatch--low" aria-hidden="true" />
            Low Density (&lt;40%)
          </li>
        </ul>

        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
          {statusMessage}
        </div>
      </div>
    </section>
  );
}
