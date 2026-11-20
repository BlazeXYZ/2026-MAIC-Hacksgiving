import { MapPin } from 'lucide-react';
import { useState } from 'react';
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

// Map coordinates match the crop of docs/design/src/common/map.json used for the image.
const MAP_FRAME = { x: 120, y: 180, width: 1250, height: 710 };
const BASEMAP = new URL('../assets/community-basemap.png', import.meta.url).href;

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

export default function CommunityMap() {
  const [selected, setSelected] = useState(SAMPLE_LOCATIONS[0]);

  return (
    <main className="hub-page community-map" aria-labelledby="community-map-title">
      <h2 id="community-map-title">Community map</h2>
      <p>Explore fictional sample locations around Milwaukee.</p>

      <div className="community-map-layout">
        <div>
          <figure className="community-map-figure">
            <div className="community-map-image">
              <img src={BASEMAP} width={MAP_FRAME.width} height={MAP_FRAME.height} alt="Street map of central Milwaukee" />
              {SAMPLE_LOCATIONS.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className="community-map-marker"
                  aria-label={`Show ${location.name} on the map`}
                  aria-pressed={selected.id === location.id}
                  onClick={() => setSelected(location)}
                  style={{
                    left: `${(location.x - MAP_FRAME.x) / MAP_FRAME.width * 100}%`,
                    top: `${(location.y - MAP_FRAME.y) / MAP_FRAME.height * 100}%`,
                  }}
                >
                  <MapPin size={22} aria-hidden="true" />
                </button>
              ))}
            </div>
            <figcaption>
              Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>
            </figcaption>
          </figure>
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
                <button type="button" aria-pressed={selected.id === location.id} onClick={() => setSelected(location)}>
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
