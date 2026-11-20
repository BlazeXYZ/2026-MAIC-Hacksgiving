import { useMemo, useState } from 'react';
import LeafletMap, { fromBasemapPoint } from './LeafletMap';
import { Icon } from './Icon';
import { useSurvey } from '../state/survey';
import './CommunityMap.css';

type Kind = 'pantry' | 'drop' | 'market';

interface SampleLocation {
  id: string;
  kind: Kind;
  key: 'loc.pantry' | 'loc.donations' | 'loc.pickup';
  neighborhood: string;
  address: string;
  people: number;
  x: number;
  y: number;
}

const SAMPLE_LOCATIONS: SampleLocation[] = [
  {
    id: 'pantry',
    kind: 'pantry',
    key: 'loc.pantry',
    neighborhood: 'Near West Side',
    address: '120 Sample Avenue, Milwaukee, WI',
    people: 24,
    x: 320,
    y: 560,
  },
  {
    id: 'donations',
    kind: 'drop',
    key: 'loc.donations',
    neighborhood: 'Haymarket',
    address: '48 Demo Street, Milwaukee, WI',
    people: 12,
    x: 785,
    y: 365,
  },
  {
    id: 'pickup',
    kind: 'market',
    key: 'loc.pickup',
    neighborhood: 'Historic Third Ward',
    address: '305 Example Lane, Milwaukee, WI',
    people: 36,
    x: 1070,
    y: 773,
  },
];


const KINDS: Array<{ id: Kind; label: 'map.f.pantry' | 'map.f.drop' | 'map.f.market' }> = [
  { id: 'pantry', label: 'map.f.pantry' },
  { id: 'drop', label: 'map.f.drop' },
  { id: 'market', label: 'map.f.market' },
];

/**
 * Map tab content (#11), laid out like the mockup's "Food tonight" (frame 7): filter chips, the map card,
 * a count line, then one card per place with Directions and "Show on map".
 */
export default function CommunityMap() {
  const { t } = useSurvey();
  const [kind, setKind] = useState<Kind | null>(null);
  const visible = useMemo(() => SAMPLE_LOCATIONS.filter((l) => !kind || l.kind === kind), [kind]);
  const markers = useMemo(
    () => visible.map(({ id, key, kind, x, y }) => ({ id, label: t(key), kind, position: fromBasemapPoint(x, y) })),
    [t, visible],
  );
  const [chosenId, setSelectedId] = useState(SAMPLE_LOCATIONS[0].id);
  // When a filter hides the chosen place, fall back to the first one still showing.
  const selectedId = visible.some((l) => l.id === chosenId) ? chosenId : visible[0]?.id ?? chosenId;

  function chip(label: string, pressed: boolean, onClick: () => void) {
    return (
      <button key={label} type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
        {pressed && <Icon name="check" />}
        {label}
      </button>
    );
  }

  return (
    <div className="community-map">
      <div className="filters" role="group" aria-label={t('map.list')}>
        {chip(t('tk.all'), kind === null, () => setKind(null))}
        {KINDS.map((k) => chip(t(k.label), kind === k.id, () => setKind(kind === k.id ? null : k.id)))}
      </div>

      <div className="ph-pad" style={{ marginTop: 16 }}>
        <LeafletMap markers={markers} selectedMarkerId={selectedId} onSelectMarker={setSelectedId} />
      </div>

      <p className="list-h">
        {t('map.count', { n: visible.length })} · {t('sample')}
      </p>
      <div className="ph-pad" style={{ display: 'grid', gap: 12 }}>
        {visible.map((loc) => {
          const [lat, lng] = fromBasemapPoint(loc.x, loc.y);
          return (
            <article key={loc.id} className="card pcard" aria-current={loc.id === selectedId}>
              <div className="top">
                <b>{t(loc.key)}</b>
                <span className="open">{t('map.people.n', { n: loc.people })}</span>
              </div>
              <span className="meta">
                {loc.neighborhood} · {loc.address}
              </span>
              <p>{t(`${loc.key}.d`)}</p>
              <div className="acts">
                <a
                  className="btn sm"
                  href={`https://www.openstreetmap.org/directions?to=${lat.toFixed(5)}%2C${lng.toFixed(5)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="nav" />
                  {t('map.dir')}
                </a>
                <button type="button" className="btn sm" aria-pressed={loc.id === selectedId} onClick={() => setSelectedId(loc.id)}>
                  <Icon name="pin" />
                  {t('map.show')}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
