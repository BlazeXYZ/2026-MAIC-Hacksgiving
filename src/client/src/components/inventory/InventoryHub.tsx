import { useState } from 'react';
import type { ReactElement } from 'react';
import { describeError, getCatalog, getPlaces } from '../../api/inventory';
import PlaceDetail from './PlaceDetail';
import { kindOfPlace, useLoad } from './util';
import './inventory.css';

interface Props {
  initialAction?: 'request' | 'give' | 'remove' | null;
  initialPlaceId?: string | null;
  onActionHandled?: () => void;
}

/**
 * Resident view of the community inventory: which pantries and community safe places need what, what
 * they have, and who nearby could help. Shelters never appear here; the server leaves them out entirely.
 */
export default function InventoryHub({ initialAction = null, initialPlaceId = null, onActionHandled }: Props = {}): ReactElement {
  const places = useLoad(getPlaces, []);
  const catalog = useLoad(getCatalog, []);
  const [openId, setOpenId] = useState<string | null>(initialPlaceId);
  const [pendingAction, setPendingAction] = useState<'request' | 'give' | 'remove' | null>(initialAction);

  return (
    <section className="inv" aria-labelledby="inv-title">
      <div className="pagehead">
        <div>
          <h1 id="inv-title">Community inventory</h1>
          <p>What pantries and community spaces have, what they need, and who nearby could help.</p>
        </div>
      </div>

      {openId ? (
        <PlaceDetail
          placeId={openId}
          catalog={catalog.data ?? []}
          initialAction={pendingAction}
          onBack={() => {
            setOpenId(null);
            setPendingAction(null);
            onActionHandled?.();
          }}
          onChanged={places.reload}
        />
      ) : places.error && !places.data ? (
        <p className="inv-error" role="alert">
          {describeError(places.error)}{' '}
          <button type="button" className="btn sm" onClick={places.reload}>
            Try again
          </button>
        </p>
      ) : !places.data ? (
        <p role="status">Loading places…</p>
      ) : places.data.length === 0 ? (
        <p className="meta">No places are listed yet.</p>
      ) : (
        <>
          {pendingAction === 'give' && (
            <div className="card" role="status" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--accent, #f97316)', padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0 }}><b>Post available supplies:</b> Select a pantry or community space below to post what you have available.</p>
            </div>
          )}
          <ul className="inv-places">
            {places.data.map((p) => (
              <li key={p.id}>
                <button type="button" className="card inv-place" onClick={() => setOpenId(p.id)}>
                  <span className="kicker">{kindOfPlace(p.kind)}</span>
                  <b>{p.name}</b>
                  <span className="meta">
                    {p.district} · {p.address}
                  </span>
                  <span className="inv-counts">
                    <span className={p.open_needs > 0 ? 'tag today' : 'tag plain'}>{p.open_needs} requested</span>
                    <span className="tag plain">{p.have + p.offers} in stock</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
