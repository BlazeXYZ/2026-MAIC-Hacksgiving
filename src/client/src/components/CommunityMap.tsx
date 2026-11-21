import { useEffect, useMemo, useState } from 'react';
import LeafletMap, { type MapMarker } from './LeafletMap';
import {
  SAMPLE_SAFE_PLACES, directionsHref, fetchSafePlaces, telHref, type SafePlace,
} from '../map/safePlaces';
import {
  SAMPLE_PANTRIES, fetchPantries, type Pantry,
} from '../map/pantries';
import './CommunityMap.css';

type DataSource = 'sample' | 'live';
type LayerFilter = 'all' | 'safe-places' | 'pantries';

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

function PantryPopup({ pantry }: { pantry: Pantry }) {
  return (
    <article aria-label={pantry.name}>
      <h3>{pantry.name}</h3>
      <div className="community-map-badge-group">
        <span className="community-map-badge community-map-badge--pantry">Food Pantry</span>
        <span className={`community-map-badge ${pantry.open_now ? 'community-map-badge--open' : 'community-map-badge--closed'}`}>
          {pantry.open_now ? 'Open Now' : 'Closed'}
        </span>
        {pantry.no_id_required && (
          <span className="community-map-badge community-map-badge--noid">No ID Required</span>
        )}
      </div>
      <dl>
        <div>
          <dt>Operating Hours</dt>
          <dd>{pantry.hours_description}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{pantry.address}</dd>
        </div>
        <div>
          <dt>Accepted Walk-ins &amp; Access</dt>
          <dd>{pantry.accessibility_notes}</dd>
        </div>
      </dl>
      <div className="community-map-popup-actions">
        {pantry.phone && (
          <a className="community-map-action community-map-action--primary" href={telHref(pantry.phone)}>
            Call {pantry.phone}
          </a>
        )}
        <a className="community-map-action" href={directionsHref(pantry)} target="_blank" rel="noopener noreferrer">
          Get route
        </a>
      </div>
    </article>
  );
}

export default function CommunityMap() {
  const [places, setPlaces] = useState<readonly SafePlace[]>(SAMPLE_SAFE_PLACES);
  const [pantries, setPantries] = useState<readonly Pantry[]>(SAMPLE_PANTRIES);
  const [source, setSource] = useState<DataSource>('sample');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters for issue #13
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [openNowOnly, setOpenNowOnly] = useState<boolean>(false);
  const [noIdRequiredOnly, setNoIdRequiredOnly] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSafePlaces(controller.signal)
      .then((live) => {
        if (live.length === 0) return;
        setPlaces(live);
        setSource('live');
      })
      .catch(() => undefined);

    fetchPantries(undefined, controller.signal)
      .then((live) => {
        if (live.length === 0) return;
        setPantries(live);
        setSource('live');
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const filteredPantries = useMemo(() => {
    return pantries.filter((p) => {
      if (openNowOnly && !p.open_now) return false;
      if (noIdRequiredOnly && !p.no_id_required) return false;
      return true;
    });
  }, [pantries, openNowOnly, noIdRequiredOnly]);

  const showSafePlaces = layerFilter === 'all' || layerFilter === 'safe-places';
  const showPantries = layerFilter === 'all' || layerFilter === 'pantries';

  const markers = useMemo<MapMarker[]>(() => {
    const items: MapMarker[] = [];

    if (showSafePlaces) {
      for (const place of places) {
        items.push({
          id: place.id,
          label: place.name,
          position: [place.latitude, place.longitude],
          variant: placeKind(place).variant,
        });
      }
    }

    if (showPantries) {
      for (const pantry of filteredPantries) {
        items.push({
          id: pantry.id,
          label: pantry.name,
          position: [pantry.latitude, pantry.longitude],
          variant: 'pantry',
        });
      }
    }

    return items;
  }, [showSafePlaces, showPantries, places, filteredPantries]);

  const selectedSafePlace = places.find((place) => place.id === selectedId) ?? null;
  const selectedPantry = filteredPantries.find((p) => p.id === selectedId) ?? null;

  return (
    <main className="hub-page community-map" aria-labelledby="community-map-title">
      <h2 id="community-map-title">Community map</h2>
      <p>Verified safe places, emergency food pantries, and shelters around Milwaukee. Tap a pin for hours, walk-in requirements, and directions.</p>

      {/* Layer selector & Pantry Filter Chips */}
      <div className="community-map-filter-bar" role="toolbar" aria-label="Map filters">
        <div className="community-map-filter-group" aria-label="Resource type">
          <button
            type="button"
            className={`community-map-chip ${layerFilter === 'all' ? 'community-map-chip--active' : ''}`}
            onClick={() => setLayerFilter('all')}
            aria-pressed={layerFilter === 'all'}
          >
            All Resources
          </button>
          <button
            type="button"
            className={`community-map-chip ${layerFilter === 'safe-places' ? 'community-map-chip--active' : ''}`}
            onClick={() => setLayerFilter('safe-places')}
            aria-pressed={layerFilter === 'safe-places'}
          >
            Safe Places
          </button>
          <button
            type="button"
            className={`community-map-chip ${layerFilter === 'pantries' ? 'community-map-chip--active' : ''}`}
            onClick={() => setLayerFilter('pantries')}
            aria-pressed={layerFilter === 'pantries'}
          >
            Food Pantries
          </button>
        </div>

        {showPantries && (
          <div className="community-map-filter-group" aria-label="Pantry filters">
            <button
              type="button"
              className={`community-map-chip community-map-chip--toggle ${openNowOnly ? 'community-map-chip--active' : ''}`}
              onClick={() => setOpenNowOnly((prev) => !prev)}
              aria-pressed={openNowOnly}
            >
              🕒 Open Now
            </button>
            <button
              type="button"
              className={`community-map-chip community-map-chip--toggle ${noIdRequiredOnly ? 'community-map-chip--active' : ''}`}
              onClick={() => setNoIdRequiredOnly((prev) => !prev)}
              aria-pressed={noIdRequiredOnly}
            >
              ✓ No ID Required
            </button>
          </div>
        )}
      </div>

      <div className="community-map-layout">
        <LeafletMap
          markers={markers}
          selectedMarkerId={selectedId}
          onSelectMarker={setSelectedId}
          popupContent={
            selectedPantry ? (
              <PantryPopup pantry={selectedPantry} />
            ) : selectedSafePlace ? (
              <SafePlacePopup place={selectedSafePlace} />
            ) : null
          }
        />

        <section className="community-map-locations" aria-labelledby="safe-places-title">
          <h3 id="safe-places-title">Directory</h3>
          <ul className="community-map-legend" aria-label="Pin legend">
            {showSafePlaces && (
              <>
                <li><span className="community-map-swatch community-map-swatch--staffed" aria-hidden="true" />Staffed Safe Haven</li>
                <li><span className="community-map-swatch community-map-swatch--verified" aria-hidden="true" />Community Verified</li>
              </>
            )}
            {showPantries && (
              <li><span className="community-map-swatch community-map-swatch--pantry" aria-hidden="true" />Food Pantry</li>
            )}
          </ul>

          <ul>
            {showPantries && filteredPantries.map((pantry) => (
              <li key={pantry.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === pantry.id}
                  onClick={() => setSelectedId(pantry.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{pantry.name}</strong>
                    <span className={`community-map-badge-mini ${pantry.open_now ? 'community-map-badge-mini--open' : 'community-map-badge-mini--closed'}`}>
                      {pantry.open_now ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <span>{pantry.district} · Food Pantry {pantry.no_id_required ? '· No ID' : ''}</span>
                </button>
              </li>
            ))}

            {showSafePlaces && places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === place.id}
                  onClick={() => setSelectedId(place.id)}
                >
                  <strong>{place.name}</strong>
                  <span>{place.district} · {placeKind(place).label}</span>
                </button>
              </li>
            ))}
          </ul>
          {source === 'sample' && (
            <p className="community-map-detail">Showing sample data. Start the API to load live community resources.</p>
          )}
        </section>
      </div>
    </main>
  );
}
