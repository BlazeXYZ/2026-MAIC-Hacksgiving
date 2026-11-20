import { useEffect, useRef, useState } from 'react';
import {
  divIcon, imageOverlay, latLngBounds, layerGroup, map as createMap, marker, polyline, tileLayer,
  type LatLngTuple, type Map as MapInstance, type Marker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from './Icon';
import { useSurvey } from '../state/survey';

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

/** Pin styles from the PROD mockup's map: colour, icon and shape per kind of place. */
export type PinKind = 'pantry' | 'drop' | 'market';
const PIN_STYLE: Record<PinKind, { icon: string; shape: 'round' | 'square' }> = {
  pantry: { icon: 'food', shape: 'round' },
  drop: { icon: 'hand', shape: 'square' },
  market: { icon: 'cal', shape: 'round' },
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** A round (or square) coloured marker with a white icon, and the place's name beside it. */
function pinIcon(kind: PinKind, label: string) {
  const { icon, shape } = PIN_STYLE[kind];
  return divIcon({
    className: `map-pin map-pin--${kind}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<span class="pin pin--${shape}"><svg class="ic"><use href="#i-${icon}"/></svg></span><span class="pinlbl">${escapeHtml(label)}</span>`,
  });
}

interface MapMarker {
  id: string;
  label: string;
  kind: PinKind;
  position: LatLngTuple;
}

interface LeafletMapProps {
  markers: readonly MapMarker[];
  selectedMarkerId: string;
  onSelectMarker: (id: string) => void;
  polylines?: readonly LatLngTuple[][];
}


export default function LeafletMap({ markers, selectedMarkerId, onSelectMarker, polylines }: LeafletMapProps) {
  const { t } = useSurvey();
  const tRef = useRef(t);
  tRef.current = t;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRefs = useRef(new Map<string, Marker>());
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

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
      setNotice(tRef.current('map.located'));
    });
    map.on('locationerror', () => {
      setLocating(false);
      setNotice(tRef.current('map.noloc'));
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

    const group = layerGroup().addTo(map);
    const visibleMarkers = new Map<string, Marker>();
    for (const { id, label, kind, position } of markers) {
      const point = marker(position, { icon: pinIcon(kind, label), title: label })
        .on('click', () => onSelectMarker(id))
        .addTo(group);
      const element = point.getElement();
      element?.setAttribute('aria-label', t('map.pin', { name: label }));
      element?.addEventListener('keydown', (event) => {
        if (event.key === ' ') {
          event.preventDefault();
          onSelectMarker(id);
        }
      });
      visibleMarkers.set(id, point);
    }
    markerRefs.current = visibleMarkers;
    return () => { group.remove(); };
  }, [markers, onSelectMarker, t]);

  useEffect(() => {
    for (const [id, point] of markerRefs.current) {
      const isSelected = id === selectedMarkerId;
      point.getElement()?.setAttribute('aria-pressed', String(isSelected));
      point.setZIndexOffset(isSelected ? 1000 : 0);
    }
    const selectedPoint = markerRefs.current.get(selectedMarkerId);
    if (selectedPoint) {
      mapRef.current?.panInside(selectedPoint.getLatLng(), { padding: [24, 32] });
    }
  }, [markers, onSelectMarker, selectedMarkerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !polylines) return;
    const paths = polyline([...polylines], { color: '#0f6b3a', weight: 5 }).addTo(map);
    return () => { paths.remove(); };
  }, [polylines]);

  // Mockup frame 7: the map sits in a `.mapcard`, with the controls as chips floating over it.
  return (
    <div className="mapcard">
      <div className="mapwrap">
        <div ref={containerRef} className="community-map-canvas" role="region" aria-label={t('map.region')} />
        <div className="mapchips">
          <button className="mapchip" type="button" disabled={locating} onClick={() => {
            mapRef.current?.setView(MILWAUKEE, 14, { animate: false });
            setNotice('');
          }}>
            <Icon name="pin" /> {t('map.recenter')}
          </button>
          <button className="mapchip" type="button" disabled={locating} onClick={() => {
            if (!mapRef.current) return;
            setNotice(t('map.locating'));
            setLocating(true);
            mapRef.current.locate({ setView: true, maxZoom: 16, timeout: 8000 });
          }}>
            <Icon name="nav" /> {t('map.locate')}
          </button>
        </div>
      </div>
      <p className="mapnote" role="status">{notice}</p>
    </div>
  );
}
