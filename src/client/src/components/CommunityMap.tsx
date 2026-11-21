import { useEffect, useMemo, useState } from 'react';
import LeafletMap, { type MapMarker } from './LeafletMap';
import {
  SAMPLE_SAFE_PLACES, directionsHref, fetchSafePlaces, telHref, type SafePlace,
} from '../map/safePlaces';
import {
  CORRIDOR_CHECKPOINTS,
  DEFAULT_CAMPUS_CORRIDOR,
  fetchCampusCorridor,
  type RouteCheckpoint,
} from '../map/campusCorridor';
import type { LatLngTuple } from 'leaflet';
import './CommunityMap.css';

type DataSource = 'sample' | 'live';

function placeKind(place: SafePlace): { variant: string; label: string } {
  return place.is_staffed
    ? { variant: 'staffed', label: 'Staffed' }
    : { variant: 'verified', label: 'Community verified' };
}

function SafePlacePopup({ place }: { place: SafePlace }) {
  const kind = placeKind(place);
  return (
    <article aria-label={place.name}>
      <h3>{place.name}</h3>
      <span className={`community-map-badge community-map-badge--${kind.variant}`}>{kind.label}</span>
      <dl>
        <div>
          <dt>Hours</dt>
          <dd>{place.hours_description}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{place.address}</dd>
        </div>
      </dl>
      <div className="community-map-popup-actions">
        {place.phone && (
          <a className="community-map-action community-map-action--primary" href={telHref(place.phone)}>
            Call {place.phone}
          </a>
        )}
        <a className="community-map-action" href={directionsHref(place)} target="_blank" rel="noopener noreferrer">
          Get route
        </a>
      </div>
    </article>
  );
}

function CheckpointPopup({ checkpoint }: { checkpoint: RouteCheckpoint }) {
  return (
    <article aria-label={checkpoint.name}>
      <h3>{checkpoint.name}</h3>
      <span className="community-map-badge community-map-badge--corridor">
        Verified Safe Lit Corridor
      </span>
      <dl>
        <div>
          <dt>Role</dt>
          <dd>{checkpoint.isStart ? 'Route Start' : checkpoint.isDestination ? 'Safe Haven Destination' : 'Checkpoint'}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{checkpoint.address}</dd>
        </div>
        <div>
          <dt>Instructions</dt>
          <dd>{checkpoint.instructions}</dd>
        </div>
      </dl>
      <div className="community-map-popup-actions">
        {checkpoint.isDestination && (
          <a className="community-map-action community-map-action--primary" href="tel:4145550102">
            Call Public Safety (414-555-0102)
          </a>
        )}
        <a
          className="community-map-action"
          href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=;${checkpoint.position[0]},${checkpoint.position[1]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Map
        </a>
      </div>
    </article>
  );
}

export default function CommunityMap() {
  const [places, setPlaces] = useState<readonly SafePlace[]>(SAMPLE_SAFE_PLACES);
  const [source, setSource] = useState<DataSource>('sample');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLitCorridor, setShowLitCorridor] = useState(true);
  const [corridorPath, setCorridorPath] = useState<LatLngTuple[]>(DEFAULT_CAMPUS_CORRIDOR);

  useEffect(() => {
    const controller = new AbortController();
    fetchSafePlaces(controller.signal)
      .then((live) => {
        if (live.length === 0) return;
        setPlaces(live);
        setSource('live');
      })
      .catch(() => undefined);

    fetchCampusCorridor(controller.signal)
      .then((coords) => {
        setCorridorPath(coords);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    const base: MapMarker[] = places.map((place) => ({
      id: place.id,
      label: place.name,
      position: [place.latitude, place.longitude],
      variant: placeKind(place).variant,
    }));

    if (showLitCorridor) {
      for (const cp of CORRIDOR_CHECKPOINTS) {
        base.push({
          id: cp.id,
          label: cp.name,
          position: cp.position,
          variant: cp.isStart ? 'route-start' : 'route-destination',
        });
      }
    }

    return base;
  }, [places, showLitCorridor]);

  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;
  const selectedCheckpoint = CORRIDOR_CHECKPOINTS.find((cp) => cp.id === selectedId) ?? null;

  return (
    <main className="hub-page community-map" aria-labelledby="community-map-title">
      <h2 id="community-map-title">Community map</h2>
      <p>Verified safe places, shelters, and illuminated walking corridors around Milwaukee. Tap a pin for hours, instructions, and directions.</p>

      <div className="community-map-toolbar">
        <button
          type="button"
          className={`community-map-route-toggle ${showLitCorridor ? 'community-map-route-toggle--active' : ''}`}
          onClick={() => setShowLitCorridor((prev) => !prev)}
          aria-pressed={showLitCorridor}
        >
          {showLitCorridor ? '✓ Safe Lit Campus Corridor' : '+ Show Safe Lit Campus Corridor'}
        </button>
      </div>

      <div className="community-map-layout">
        <LeafletMap
          markers={markers}
          selectedMarkerId={selectedId}
          onSelectMarker={setSelectedId}
          polylines={showLitCorridor ? [corridorPath] : undefined}
          popupContent={
            selectedCheckpoint ? (
              <CheckpointPopup checkpoint={selectedCheckpoint} />
            ) : selectedPlace ? (
              <SafePlacePopup place={selectedPlace} />
            ) : null
          }
        />

        <section className="community-map-locations" aria-labelledby="safe-places-title">
          <h3 id="safe-places-title">Safe Places &amp; Corridors</h3>
          <ul className="community-map-legend" aria-label="Pin legend">
            <li><span className="community-map-swatch community-map-swatch--staffed" aria-hidden="true" />Staffed Safe Place</li>
            <li><span className="community-map-swatch community-map-swatch--verified" aria-hidden="true" />Community Verified</li>
            {showLitCorridor && (
              <>
                <li><span className="community-map-swatch community-map-swatch--corridor" aria-hidden="true" />Verified Lit Campus Corridor</li>
                <li><span className="community-map-swatch community-map-swatch--start" aria-hidden="true" />Corridor Start (Diercks Hall)</li>
                <li><span className="community-map-swatch community-map-swatch--dest" aria-hidden="true" />Corridor End (Public Safety)</li>
              </>
            )}
          </ul>

          <ul>
            {showLitCorridor && (
              <li className="community-map-corridor-card">
                <strong>Campus Safe Lit Walkway</strong>
                <p>Well-lit pedestrian corridor connecting Diercks Hall (1025 N Milwaukee St) to MSOE Public Safety (1025 N Broadway).</p>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    aria-pressed={selectedId === 'corridor-start-diercks'}
                    onClick={() => setSelectedId('corridor-start-diercks')}
                  >
                    Start: Diercks Hall
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectedId === 'corridor-dest-safety'}
                    onClick={() => setSelectedId('corridor-dest-safety')}
                  >
                    End: Public Safety
                  </button>
                </div>
              </li>
            )}

            {places.map((place) => (
              <li key={place.id}>
                <button type="button" aria-pressed={selectedId === place.id} onClick={() => setSelectedId(place.id)}>
                  <strong>{place.name}</strong>
                  <span>{place.district} · {placeKind(place).label}</span>
                </button>
              </li>
            ))}
          </ul>
          {source === 'sample' && (
            <p className="community-map-detail">Showing sample data. Start the API to load live safe places.</p>
          )}
        </section>
      </div>
    </main>
  );
}
