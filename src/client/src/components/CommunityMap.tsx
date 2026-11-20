import { useEffect, useMemo, useState } from 'react';
import LeafletMap, { type MapMarker } from './LeafletMap';
import {
  SAMPLE_SAFE_PLACES, directionsHref, fetchSafePlaces, telHref, type SafePlace,
} from '../map/safePlaces';
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

export default function CommunityMap() {
  const [places, setPlaces] = useState<readonly SafePlace[]>(SAMPLE_SAFE_PLACES);
  const [source, setSource] = useState<DataSource>('sample');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchSafePlaces(controller.signal)
      .then((live) => {
        if (live.length === 0) return;
        setPlaces(live);
        setSource('live');
      })
      // Keep the sample places when the API is not running.
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const markers = useMemo<MapMarker[]>(
    () => places.map((place) => ({
      id: place.id,
      label: place.name,
      position: [place.latitude, place.longitude],
      variant: placeKind(place).variant,
    })),
    [places],
  );

  const selected = places.find((place) => place.id === selectedId) ?? null;

  return (
    <main className="hub-page community-map" aria-labelledby="community-map-title">
      <h2 id="community-map-title">Community map</h2>
      <p>Verified safe places and shelters around Milwaukee. Tap a pin for hours, a call button, and directions.</p>

      <div className="community-map-layout">
        <LeafletMap
          markers={markers}
          selectedMarkerId={selected?.id ?? null}
          onSelectMarker={setSelectedId}
          popupContent={selected ? <SafePlacePopup place={selected} /> : null}
        />

        <section className="community-map-locations" aria-labelledby="safe-places-title">
          <h3 id="safe-places-title">Safe places</h3>
          <ul className="community-map-legend" aria-label="Pin legend">
            <li><span className="community-map-swatch community-map-swatch--staffed" aria-hidden="true" />Staffed</li>
            <li><span className="community-map-swatch community-map-swatch--verified" aria-hidden="true" />Community verified</li>
          </ul>
          <ul>
            {places.map((place) => (
              <li key={place.id}>
                <button type="button" aria-pressed={selected?.id === place.id} onClick={() => setSelectedId(place.id)}>
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
