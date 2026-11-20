import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  divIcon, imageOverlay, latLngBounds, layerGroup, map as createMap, marker, polyline, tileLayer,
  type DivIcon, type LatLngTuple, type Map as MapInstance, type Marker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MILWAUKEE: LatLngTuple = [43.0389, -87.9065];
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const BASEMAP = new URL('../assets/community-basemap.png', import.meta.url).href;

// Reverse the projection from docs/design/src/common/build_map.py for the local basemap crop.
const LONGITUDE_SCALE = Math.cos(43.042 * Math.PI / 180) * 111320 / 4;
const LATITUDE_SCALE = 110950 / 4;

export function fromBasemapPoint(x: number, y: number): LatLngTuple {
  return [43.062 - y / LATITUDE_SCALE, -87.958 + x / LONGITUDE_SCALE];
}

const BASEMAP_BOUNDS = latLngBounds(fromBasemapPoint(120, 890), fromBasemapPoint(1370, 180));

export interface MapMarker {
  id: string;
  label: string;
  position: LatLngTuple;
  /** Adds a `community-map-pin--<variant>` class so each layer can style its pins. */
  variant?: string;
}

interface LeafletMapProps {
  markers: readonly MapMarker[];
  selectedMarkerId: string | null;
  /** Called with a marker id when it is selected, and with `null` when its popup closes. */
  onSelectMarker: (id: string | null) => void;
  /** Rendered inside the selected marker's popup. Markers open no popup when this is omitted. */
  popupContent?: ReactNode;
  polylines?: readonly LatLngTuple[][];
}

const PIN_ICONS = new Map<string, DivIcon>();

function pinIcon(variant?: string): DivIcon {
  const key = variant ?? '';
  let icon = PIN_ICONS.get(key);
  if (!icon) {
    const className = variant ? `community-map-pin community-map-pin--${variant}` : 'community-map-pin';
    icon = divIcon({ className, iconSize: [36, 36], iconAnchor: [18, 30], popupAnchor: [0, -28] });
    PIN_ICONS.set(key, icon);
  }
  return icon;
}

export default function LeafletMap({
  markers, selectedMarkerId, onSelectMarker, popupContent, polylines,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRefs = useRef(new Map<string, Marker>());
  const selectedRef = useRef(selectedMarkerId);
  const onSelectRef = useRef(onSelectMarker);
  const [popupHosts, setPopupHosts] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map());
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const hasPopups = popupContent !== undefined;

  useEffect(() => {
    onSelectRef.current = onSelectMarker;
  }, [onSelectMarker]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A zoom transition can outlive the map when someone switches screens mid-zoom.
    const map = createMap(container, { scrollWheelZoom: false, zoomAnimation: false, maxZoom: 19 });
    mapRef.current = map;
    map.fitBounds(BASEMAP_BOUNDS, { maxZoom: 15 });

    map.createPane('local-basemap').style.zIndex = '190';
    imageOverlay(BASEMAP, BASEMAP_BOUNDS, { pane: 'local-basemap', attribution: ATTRIBUTION }).addTo(map);
    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    map.on('locationfound', () => {
      setLocating(false);
      setNotice('Map centered on your location.');
    });
    map.on('locationerror', () => {
      setLocating(false);
      setNotice('Location unavailable. You can still browse the map.');
    });

    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    return () => {
      observer.disconnect();
      map.stopLocate();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Removing a marker closes its popup; don't report that as the user closing it.
    let disposing = false;
    const group = layerGroup().addTo(map);
    const visibleMarkers = new Map<string, Marker>();
    const hosts = new Map<string, HTMLElement>();
    // Leave room around the popup on narrow phones so it never touches the map edges.
    const popupWidth = Math.max(180, Math.min(280, map.getSize().x - 96));
    for (const { id, label, position, variant } of markers) {
      const point = marker(position, { icon: pinIcon(variant), title: label });
      if (hasPopups) {
        // React renders the popup body into this element through a portal.
        const host = document.createElement('div');
        host.className = 'community-map-popup';
        hosts.set(id, host);
        point
          .bindPopup(host, { minWidth: Math.min(220, popupWidth), maxWidth: popupWidth, autoPanPadding: [16, 24] })
          .on('popupopen', () => onSelectRef.current(id))
          .on('popupclose', () => {
            if (!disposing && selectedRef.current === id) onSelectRef.current(null);
          });
      } else {
        point.on('click', () => onSelectRef.current(id));
      }
      point.addTo(group);
      const element = point.getElement();
      element?.setAttribute('aria-label', `Show ${label} on the map`);
      element?.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === ' ') {
          event.preventDefault();
          if (hasPopups) point.openPopup();
          else onSelectRef.current(id);
        }
      });
      visibleMarkers.set(id, point);
    }
    markerRefs.current = visibleMarkers;
    setPopupHosts(hosts);
    if (markers.length > 0) {
      map.fitBounds(latLngBounds(markers.map(({ position }) => position)), { padding: [48, 48], maxZoom: 15 });
    }
    return () => {
      disposing = true;
      group.remove();
    };
  }, [markers, hasPopups]);

  // A layout effect, so a popup opened from outside the map is sized after its portal content renders.
  useLayoutEffect(() => {
    selectedRef.current = selectedMarkerId;
    for (const [id, point] of markerRefs.current) {
      const isSelected = id === selectedMarkerId;
      point.getElement()?.setAttribute('aria-pressed', String(isSelected));
      point.setZIndexOffset(isSelected ? 1000 : 0);
    }
    const selectedPoint = selectedMarkerId ? markerRefs.current.get(selectedMarkerId) : undefined;
    if (!selectedPoint) {
      if (hasPopups) mapRef.current?.closePopup();
      return;
    }
    if (!hasPopups) {
      mapRef.current?.panInside(selectedPoint.getLatLng(), { padding: [24, 32] });
    } else if (selectedPoint.isPopupOpen()) {
      selectedPoint.getPopup()?.update();
    } else {
      selectedPoint.openPopup();
    }
  }, [markers, selectedMarkerId, popupHosts, popupContent, hasPopups]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !polylines) return;
    const paths = polyline([...polylines], { color: '#0f766e', weight: 5 }).addTo(map);
    return () => { paths.remove(); };
  }, [polylines]);

  const selectedPopupHost = hasPopups && selectedMarkerId ? popupHosts.get(selectedMarkerId) : undefined;

  return (
    <div className="community-map-figure">
      <div ref={containerRef} className="community-map-canvas" role="region" aria-label="Interactive street map of Milwaukee" />
      <div className="community-map-tools">
        <button type="button" disabled={locating} onClick={() => {
          mapRef.current?.setView(MILWAUKEE, 14, { animate: false });
          setNotice('');
        }}>
          Recenter on Milwaukee
        </button>
        <button type="button" disabled={locating} onClick={() => {
          if (!mapRef.current) return;
          setNotice('Finding your location…');
          setLocating(true);
          mapRef.current.locate({ setView: true, maxZoom: 16, timeout: 8000 });
        }}>
          Locate me
        </button>
        <span role="status">{notice}</span>
      </div>
      {selectedPopupHost && createPortal(popupContent, selectedPopupHost)}
    </div>
  );
}
