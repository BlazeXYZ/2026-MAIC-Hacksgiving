import { useState } from 'react';
import type { ReactElement } from 'react';
import { describeError, getDemand, getMatches, getPlace } from '../../api/inventory';
import type { CatalogItem, EntryView, HandoffView, SourceView } from '../../contracts/inventory';
import PostEntryForm from './PostEntryForm';
import RemoveInventoryPanel from './RemoveInventoryPanel';
import { kindOfPlace, useLoad } from './util';

type Action = 'request' | 'give' | 'remove';

const ACTIONS: Array<{ id: Action; label: string }> = [
  { id: 'request', label: 'Request item' },
  { id: 'give', label: 'Give item' },
  { id: 'remove', label: 'Remove inventory' },
];

/** How many nearby places to name under a row before saying "and N more". */
const HINTS_SHOWN = 2;

function miles(m: number): string {
  return m < 0.1 ? 'under 0.1 mi' : `${m.toFixed(1)} mi`;
}

/** One short line under a row: who nearby could fill it, or who nearby is asking for it. */
function Hints({ sources, verb, none }: { sources: SourceView[]; verb: (s: SourceView) => string; none: string }): ReactElement {
  if (sources.length === 0) return <span className="inv-hint none">{none}</span>;
  const shown = sources.slice(0, HINTS_SHOWN);
  const more = sources.length - shown.length;
  return (
    <span className="inv-hint">
      {shown.map((s) => `${s.location} ${verb(s)} (${miles(s.distance_miles)})`).join(' · ')}
      {more > 0 ? ` · and ${more} more` : ''}
    </span>
  );
}

function Row({ entry, children }: { entry: EntryView; children: ReactElement }): ReactElement {
  return (
    <li>
      <span className="inv-rowmain">
        <b>{entry.item.name}</b> × {entry.quantity}
        {!entry.verified && (
          <span className="tag held" title="The system guessed this match. A coordinator will confirm it.">
            Unconfirmed
          </span>
        )}
      </span>
      {children}
    </li>
  );
}

interface Props {
  placeId: string;
  catalog: CatalogItem[];
  initialAction?: Action | null;
  onBack: () => void;
  onChanged: () => void;
}

/**
 * One place, in two boxes: what it has asked for, and what it has. Three buttons change those lists. Who nearby
 * could help (or is asking) is one line under each row instead of separate panels.
 */
export default function PlaceDetail({ placeId, catalog, initialAction = null, onBack, onChanged }: Props): ReactElement {
  const place = useLoad(() => getPlace(placeId), [placeId]);
  const matches = useLoad(() => getMatches(placeId), [placeId]);
  const demand = useLoad(() => getDemand(placeId), [placeId]);
  const [action, setAction] = useState<Action | null>(initialAction);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh(): void {
    place.reload();
    matches.reload();
    demand.reload();
    onChanged();
  }

  function removed(h: HandoffView): void {
    const left = h.remaining === 0 ? 'None left, so it is gone from the list.' : `${h.remaining} left.`;
    const need = h.need_remaining === 0 ? ` ${h.to_location} no longer needs it.` : '';
    setNotice(`Removed ${h.quantity} ${h.item.name}. ${left}${need}`);
    refresh();
  }

  const data = place.data;
  const requested = data?.need ?? [];
  const inventory: EntryView[] = data ? [...data.have, ...data.offer] : [];
  const sourcesForNeed = (id: string): SourceView[] => matches.data?.find((m) => m.need_id === id)?.sources ?? [];
  const needersFor = (id: string): SourceView[] => demand.data?.find((d) => d.entry_id === id)?.needed_at ?? [];
  const isOffer = (id: string): boolean => data?.offer.some((e) => e.id === id) ?? false;

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

          <div className="inv-actionbar" role="group" aria-label="Actions">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="btn inv-act"
                aria-expanded={action === a.id}
                aria-controls="inv-panel"
                onClick={() => {
                  setAction(action === a.id ? null : a.id);
                  setNotice(null);
                }}
              >
                {a.label}
              </button>
            ))}
          </div>

          {action && (
            <section id="inv-panel" className="card inv-panel" aria-label={ACTIONS.find((a) => a.id === action)?.label}>
              <div className="inv-panel-head">
                <h3>{ACTIONS.find((a) => a.id === action)?.label}</h3>
                <button type="button" className="btn ghost sm" onClick={() => setAction(null)}>
                  Close
                </button>
              </div>
              {action === 'request' && <PostEntryForm placeId={placeId} catalog={catalog} kind="need" onPosted={refresh} />}
              {action === 'give' && <PostEntryForm placeId={placeId} catalog={catalog} kind="have" onPosted={refresh} />}
              {action === 'remove' && (
                <RemoveInventoryPanel
                  inventory={inventory}
                  demand={demand.data ?? []}
                  adminKey={adminKey}
                  onUnlock={setAdminKey}
                  onRemoved={removed}
                />
              )}
              {notice && (
                <p className="inv-ok" role="status">
                  {notice}
                </p>
              )}
            </section>
          )}

          <div className="inv-boxes">
            <section className="card inv-group" aria-label="Requested items">
              <h3>
                Requested items <span className="count">{requested.length}</span>
              </h3>
              {requested.length === 0 ? (
                <p className="meta">Nothing requested.</p>
              ) : (
                <ul className="inv-list">
                  {requested.map((e) => (
                    <Row key={e.id} entry={e}>
                      <Hints
                        sources={sourcesForNeed(e.id)}
                        verb={(s) => (s.kind === 'offer' ? `is offering ${s.quantity}` : `has ${s.quantity}`)}
                        none="No one nearby has this yet."
                      />
                    </Row>
                  ))}
                </ul>
              )}
            </section>

            <section className="card inv-group" aria-label="Current inventory">
              <h3>
                Current inventory <span className="count">{inventory.length}</span>
              </h3>
              {inventory.length === 0 ? (
                <p className="meta">Nothing in the inventory.</p>
              ) : (
                <ul className="inv-list">
                  {inventory.map((e) => (
                    <Row key={e.id} entry={e}>
                      <Hints
                        sources={needersFor(e.id)}
                        verb={(s) => `needs ${s.quantity}`}
                        none={isOffer(e.id) ? 'Offered. No one nearby is asking for it.' : 'No one nearby is asking for this.'}
                      />
                    </Row>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
