import { useState } from 'react';
import type { ReactElement } from 'react';
import { closeEntry, describeError, getDemand, getHandoffs, getPlace } from '../../../api/inventory';
import type { EntryView, HandoffView, PlaceSummary } from '../../../contracts/inventory';
import { expiresIn, useLoad } from '../util';
import HandoffForm from './HandoffForm';

interface Props {
  adminKey: string;
  places: PlaceSummary[];
}

/** One sentence about what a hand-off did, including whether the entry is gone from "who can help". */
function summarize(h: HandoffView): string {
  const gone = h.remaining === 0 ? ' None left, so it no longer shows in "Who can help".' : ` ${h.remaining} left.`;
  const need =
    h.need_remaining === null ? '' : h.need_remaining === 0 ? ` The need at ${h.to_location} is covered.` : ` ${h.to_location} still needs ${h.need_remaining}.`;
  return `Passed over ${h.quantity} ${h.item.name}.${gone}${need}`;
}

/**
 * Everything posted at one place. A coordinator can close a post, or record that stock or an offer was
 * passed over, which lowers it (and disappears it at zero) so "who can help" stops pointing at it.
 */
export default function PostsPanel({ adminKey, places }: Props): ReactElement {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const detail = useLoad(() => (placeId ? getPlace(placeId) : Promise.resolve(null)), [placeId]);
  const demand = useLoad(() => (placeId ? getDemand(placeId) : Promise.resolve([])), [placeId]);
  const log = useLoad(() => getHandoffs(adminKey), [adminKey]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh(): void {
    detail.reload();
    demand.reload();
    log.reload();
  }

  async function close(entry: EntryView): Promise<void> {
    setBusyId(entry.id);
    setError(null);
    try {
      await closeEntry(adminKey, entry.id);
      refresh();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  const groups: Array<{ title: string; entries: EntryView[]; canPassOver: boolean }> = detail.data
    ? [
        { title: 'Needs', entries: detail.data.need, canPassOver: false },
        { title: 'In stock', entries: detail.data.have, canPassOver: true },
        { title: 'Offered', entries: detail.data.offer, canPassOver: true },
      ]
    : [];

  /** Open needs elsewhere for this entry's item, from the same data as "Who could use this". */
  const needsFor = (entryId: string) => demand.data?.find((d) => d.entry_id === entryId)?.needed_at ?? [];

  return (
    <div className="inv-stack">
      <div className="inv-inline">
        <label className="inv-label" htmlFor="posts-place">
          Place
        </label>
        <select
          id="posts-place"
          className="inv-input"
          value={placeId}
          onChange={(e) => {
            setPlaceId(e.target.value);
            setOpenId(null);
            setNotice(null);
          }}
        >
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
      {notice && (
        <p className="inv-ok" role="status">
          {notice}
        </p>
      )}

      {groups.map(({ title, entries, canPassOver }) => (
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
                    <b>{e.item.name}</b> × {e.quantity} {!e.verified && <span className="tag held">Unconfirmed</span>}
                  </span>
                  <span className="meta">{expiresIn(e.expires_at)}</span>
                  <span className="inv-rowact">
                    {canPassOver && (
                      <button
                        type="button"
                        className="btn sm"
                        aria-expanded={openId === e.id}
                        onClick={() => {
                          setOpenId(openId === e.id ? null : e.id);
                          setNotice(null); // an older result would only confuse the next one
                        }}
                      >
                        Passed over
                      </button>
                    )}
                    <button type="button" className="btn sm" disabled={busyId === e.id} onClick={() => void close(e)}>
                      Close
                    </button>
                  </span>
                  {canPassOver && openId === e.id && (
                    <HandoffForm
                      adminKey={adminKey}
                      entry={e}
                      needs={needsFor(e.id)}
                      onCancel={() => setOpenId(null)}
                      onDone={(result) => {
                        setNotice(summarize(result));
                        setOpenId(null);
                        refresh();
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="card inv-group" aria-label="Recent hand-offs">
        <h3>
          Recent hand-offs <span className="count">{log.data?.length ?? 0}</span>
        </h3>
        {!log.data || log.data.length === 0 ? (
          <p className="meta">Nothing has been passed over yet.</p>
        ) : (
          <ul className="inv-list">
            {log.data.slice(0, 10).map((h) => (
              <li key={h.id}>
                <span>
                  <b>
                    {h.item.name} × {h.quantity}
                  </b>{' '}
                  from {h.from_location}
                  {h.to_location ? ` to ${h.to_location}` : ', recipient not recorded'}
                </span>
                <span className="meta">{h.remaining === 0 ? 'none left' : `${h.remaining} left`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
