import { useState } from 'react';
import type { ReactElement } from 'react';
import { closeEntry, describeError, getPlace } from '../../../api/inventory';
import type { EntryView, PlaceSummary } from '../../../contracts/inventory';
import { expiresIn, useLoad } from '../util';

interface Props {
  adminKey: string;
  places: PlaceSummary[];
}

/** Everything posted at one place, with a Close button for filled needs and for bad posts. */
export default function PostsPanel({ adminKey, places }: Props): ReactElement {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const detail = useLoad(() => (placeId ? getPlace(placeId) : Promise.resolve(null)), [placeId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function close(entry: EntryView): Promise<void> {
    setBusyId(entry.id);
    setError(null);
    try {
      await closeEntry(adminKey, entry.id);
      detail.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  const groups: Array<[string, EntryView[]]> = detail.data
    ? [
        ['Needs', detail.data.need],
        ['In stock', detail.data.have],
        ['Offered', detail.data.offer],
      ]
    : [];

  return (
    <div className="inv-stack">
      <div className="inv-inline">
        <label className="inv-label" htmlFor="posts-place">
          Place
        </label>
        <select id="posts-place" className="inv-input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="inv-error" role="alert">
          {error}
        </p>
      )}

      {groups.map(([title, entries]) => (
        <section key={title} className="card inv-group" aria-label={title}>
          <h3>
            {title} <span className="count">{entries.length}</span>
          </h3>
          {entries.length === 0 ? (
            <p className="meta">None.</p>
          ) : (
            <ul className="inv-list">
              {entries.map((e) => (
                <li key={e.id}>
                  <span>
                    <b>{e.item.name}</b> × {e.quantity}{' '}
                    {!e.verified && <span className="tag held">Unconfirmed</span>}
                  </span>
                  <span className="meta">{expiresIn(e.expires_at)}</span>
                  <button type="button" className="btn sm" disabled={busyId === e.id} onClick={() => void close(e)}>
                    Close
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
