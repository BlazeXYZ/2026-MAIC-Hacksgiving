import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { getPlace, getPlaces } from '../../api/inventory';
import type { PlaceDetailData, PlaceSummary } from '../../contracts/inventory';

interface Props {
  onOpenPlace: (placeId: string) => void;
}

export default function NearbyInventoryRequests({ onOpenPlace }: Props): ReactElement {
  const [places, setPlaces] = useState<PlaceSummary[] | null>(null);
  const [details, setDetails] = useState<PlaceDetailData[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    getPlaces()
      .then(async (listed) => {
        if (ctrl.signal.aborted) return;
        setPlaces(listed);
        const loaded = await Promise.all(listed.map((place) => getPlace(place.id)));
        if (!ctrl.signal.aborted) setDetails(loaded);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError(true);
      });
    return () => ctrl.abort();
  }, []);

  if (error) {
    return <p className="meta" role="status">Inventory requests are unavailable right now.</p>;
  }
  if (places === null) return <p className="meta" role="status">Loading nearby inventory requests…</p>;

  const requesting = details.filter((detail) => detail.need.length > 0);
  return (
    <section className="mod" aria-labelledby="nearby-inventory-title" style={{ marginBottom: '1rem' }}>
      <div className="mod-h">
        <h2 id="nearby-inventory-title">Nearby item requests</h2>
        {requesting.length > 0 && <span className="count">{requesting.length} places</span>}
      </div>
      <div className="mod-b">
        {requesting.length === 0 ? (
          <p className="meta">No open item requests at nearby safe places.</p>
        ) : (
          <ul className="inv-list">
            {requesting.map((detail) => (
              <li key={detail.location.id}>
                <button type="button" className="inv-place" onClick={() => onOpenPlace(detail.location.id)}>
                  <b>{detail.location.name}</b>
                  <span className="meta">{detail.location.district} · {detail.location.address}</span>
                  <span className="inv-hint">
                    {detail.need.slice(0, 3).map((entry) => `${entry.quantity} ${entry.item.name}`).join(' · ')}
                    {detail.need.length > 3 ? ` · and ${detail.need.length - 3} more` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
