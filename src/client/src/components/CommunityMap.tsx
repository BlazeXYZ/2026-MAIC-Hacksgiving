import { useState } from 'react';
import LeafletMap, { fromBasemapPoint } from './LeafletMap';
import './CommunityMap.css';

interface SampleLocation {
  id: string;
  name: string;
  neighborhood: string;
  description: string;
  address: string;
  people: number;
  x: number;
  y: number;
}

const SAMPLE_LOCATIONS: SampleLocation[] = [
  {
    id: 'pantry',
    name: 'Community Pantry',
    neighborhood: 'Near West Side',
    description: 'A demo location for picking up shelf-stable groceries.',
    address: '120 Sample Avenue, Milwaukee, WI',
    people: 24,
    x: 320,
    y: 560,
  },
  {
    id: 'donations',
    name: 'Donation Drop-off',
    neighborhood: 'Haymarket',
    description: 'A demo drop-off point for canned goods and dry foods.',
    address: '48 Demo Street, Milwaukee, WI',
    people: 12,
    x: 785,
    y: 365,
  },
  {
    id: 'pickup',
    name: 'Mobile Market Stop',
    neighborhood: 'Historic Third Ward',
    description: 'A demo stop for a pop-up produce market.',
    address: '305 Example Lane, Milwaukee, WI',
    people: 36,
    x: 1070,
    y: 773,
  },
];

const MARKERS = SAMPLE_LOCATIONS.map(({ id, name, x, y }) => ({ id, label: name, position: fromBasemapPoint(x, y) }));

export default function CommunityMap() {
  const [selectedId, setSelectedId] = useState(SAMPLE_LOCATIONS[0].id);
  const selected = SAMPLE_LOCATIONS.find((location) => location.id === selectedId) ?? SAMPLE_LOCATIONS[0];

  return (
    <main className="hub-page community-map" aria-labelledby="community-map-title">
      <h2 id="community-map-title">Community map</h2>
      <p>Explore fictional sample locations around Milwaukee.</p>

      <div className="community-map-layout">
        <div>
          <LeafletMap markers={MARKERS} selectedMarkerId={selected.id} onSelectMarker={setSelectedId} />
          <div className="community-map-event" role="status" aria-atomic="true">
            <h3>{selected.name}</h3>
            <dl>
              <div>
                <dt>Sample address</dt>
                <dd>{selected.address}</dd>
              </div>
              <div>
                <dt>People</dt>
                <dd>{selected.people}</dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="community-map-locations" aria-labelledby="sample-locations-title">
          <h3 id="sample-locations-title">Sample locations</h3>
          <ul>
            {SAMPLE_LOCATIONS.map((location) => (
              <li key={location.id}>
                <button type="button" aria-pressed={selected.id === location.id} onClick={() => setSelectedId(location.id)}>
                  <strong>{location.name}</strong>
                  <span>{location.neighborhood}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="community-map-detail">{selected.description}</p>
        </section>
      </div>
    </main>
  );
}
