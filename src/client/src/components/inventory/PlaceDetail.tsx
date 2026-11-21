import type { ReactElement } from 'react';
import { describeError, getDemand, getMatches, getPlace } from '../../api/inventory';
import type { CatalogItem, DemandView, EntryView, MatchView, SourceView } from '../../contracts/inventory';
import PostEntryForm from './PostEntryForm';
import { expiresIn, kindOfPlace, useLoad } from './util';

function EntryList({ title, entries, empty }: { title: string; entries: EntryView[]; empty: string }): ReactElement {
  return (
    <section className="card inv-group" aria-label={title}>
      <h3>
        {title} <span className="count">{entries.length}</span>
      </h3>
      {entries.length === 0 ? (
        <p className="meta">{empty}</p>
      ) : (
        <ul className="inv-list">
          {entries.map((e) => (
            <li key={e.id}>
              <span>
                <b>{e.item.name}</b> × {e.quantity}
              </span>
              {!e.verified && (
                <span className="tag held" title="The system guessed this match. A coordinator will confirm it.">
                  Unconfirmed
                </span>
              )}
              <span className="meta">{expiresIn(e.expires_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Two posts for the same item would list the same places twice, so combine them and add up the quantities. */
function mergeByItem<T extends { item: { id: string }; quantity: number }>(rows: T[], extraKey: (row: T) => string = () => ''): T[] {
  const merged = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.item.id}|${extraKey(row)}`;
    const prior = merged.get(key);
    merged.set(key, prior ? { ...prior, quantity: prior.quantity + row.quantity } : row);
  }
  return [...merged.values()];
}

function Sources({ sources, none }: { sources: SourceView[]; none: string }): ReactElement {
  if (sources.length === 0) return <p className="meta">{none}</p>;
  return (
    <ul className="inv-list">
      {sources.map((s) => (
        <li key={`${s.location_id}-${s.kind}`}>
          <span>
            <b>{s.location}</b> · {s.quantity} {s.kind === 'offer' ? 'offered' : s.kind === 'need' ? 'needed' : 'in stock'}
          </span>
          <span className="meta">{s.distance_miles < 0.1 ? 'under 0.1 mi' : `${s.distance_miles.toFixed(1)} mi`}</span>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  placeId: string;
  catalog: CatalogItem[];
  onBack: () => void;
  onChanged: () => void;
}

/** One place: what it needs, has, and is offered, a form to add to that, and who could help in either direction. */
export default function PlaceDetail({ placeId, catalog, onBack, onChanged }: Props): ReactElement {
  const place = useLoad(() => getPlace(placeId), [placeId]);
  const matches = useLoad(() => getMatches(placeId), [placeId]);
  const demand = useLoad(() => getDemand(placeId), [placeId]);

  function refresh(): void {
    place.reload();
    matches.reload();
    demand.reload();
    onChanged();
  }

  const data = place.data;
  return (
    <div className="inv-detail">
      <button type="button" className="btn ghost" onClick={onBack}>
        ← All places
      </button>

      {place.error && !data ? (
        <p className="inv-error" role="alert">
          {describeError(place.error)}{' '}
          <button type="button" className="btn sm" onClick={place.reload}>
            Try again
          </button>
        </p>
      ) : !data ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          <header className="inv-head">
            <div className="kicker">{kindOfPlace(data.location.kind)}</div>
            <h2>{data.location.name}</h2>
            <p className="meta">
              {data.location.address} · {data.location.district}
            </p>
          </header>

          <div className="inv-cols">
            <EntryList title="Needs" entries={data.need} empty="Nothing needed right now." />
            <EntryList title="In stock" entries={data.have} empty="Nothing listed yet." />
            <EntryList title="Offered" entries={data.offer} empty="No offers right now." />
          </div>

          <div className="inv-cols two">
            <section className="card inv-group" aria-label="Who can help">
              <h3>Who can help</h3>
              <p className="meta">Nearby places that have, or are being offered, what this place needs.</p>
              {matches.data && matches.data.length > 0 ? (
                mergeByItem<MatchView>(matches.data).map((m) => (
                  <div key={m.need_id} className="inv-match">
                    <h4>
                      {m.item.name} × {m.quantity}
                    </h4>
                    <Sources sources={m.sources} none="Nobody has listed this yet." />
                  </div>
                ))
              ) : (
                <p className="meta">{matches.loading ? 'Looking…' : 'No open needs to match.'}</p>
              )}
            </section>

            <section className="card inv-group" aria-label="Who could use this">
              <h3>Who could use this</h3>
              <p className="meta">Open needs elsewhere that this place&rsquo;s stock or offers could fill.</p>
              {demand.data && demand.data.length > 0 ? (
                mergeByItem<DemandView>(demand.data, (d) => d.kind).map((d) => (
                  <div key={d.entry_id} className="inv-match">
                    <h4>
                      {d.item.name} × {d.quantity} <span className="meta">({d.kind === 'offer' ? 'offered' : 'in stock'})</span>
                    </h4>
                    <Sources sources={d.needed_at} none="No open needs for this elsewhere." />
                  </div>
                ))
              ) : (
                <p className="meta">{demand.loading ? 'Looking…' : 'Nothing in stock or offered yet.'}</p>
              )}
            </section>
          </div>

          <section className="card inv-group" aria-label="Add to this place">
            <h3>Add to this place</h3>
            <PostEntryForm placeId={placeId} catalog={catalog} onPosted={refresh} />
          </section>
        </>
      )}
    </div>
  );
}
