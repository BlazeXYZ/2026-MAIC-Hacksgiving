import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { describeError, getCatalog, getGuesses, getHeld, getPlaces } from '../../../api/inventory';
import KeyPrompt from '../KeyPrompt';
import { useLoad } from '../util';
import '../inventory.css';
import AliasesPanel from './AliasesPanel';
import { GuessesPanel, HeldPanel } from './HeldPanel';
import ItemsPanel from './ItemsPanel';
import PostsPanel from './PostsPanel';

type Tab = 'held' | 'guesses' | 'aliases' | 'items' | 'posts';

/**
 * Coordinator review for the community inventory. The coordinator key is held in memory only, so it is
 * gone on reload or when the tab closes.
 */
export default function InventoryReview({ initialKey }: { initialKey?: string | null } = {}): ReactElement {
  const [adminKey, setAdminKey] = useState<string | null>(initialKey ?? null);
  return (
    <section className="inv" aria-labelledby="invr-title">
      <div className="pagehead">
        <div>
          <h1 id="invr-title">Inventory review</h1>
          <p>Confirm what the system guessed, name new items, and keep the wording list clean.</p>
        </div>
        {adminKey && (
          <button type="button" className="btn" onClick={() => setAdminKey(null)}>
            Lock
          </button>
        )}
      </div>

      {adminKey === null ? (
        <div className="card inv-gate">
          <KeyPrompt reason="Reviewing the inventory needs the coordinator key." onUnlock={setAdminKey} />
        </div>
      ) : (
        <Workspace adminKey={adminKey} />
      )}
    </section>
  );
}

function Workspace({ adminKey }: { adminKey: string }): ReactElement {
  const [tab, setTab] = useState<Tab>('held');
  const places = useLoad(getPlaces, []);
  const catalog = useLoad(getCatalog, []);
  const held = useLoad(() => getHeld(adminKey), [adminKey]);
  const guesses = useLoad(() => getGuesses(adminKey), [adminKey]);

  const items = useMemo(() => (catalog.data ?? []).map(({ id, name }) => ({ id, name })), [catalog.data]);
  const placeNames = useMemo(() => Object.fromEntries((places.data ?? []).map((p) => [p.id, p.name])), [places.data]);
  const heldGroups = useMemo(() => new Set((held.data ?? []).map((h) => h.label.trim().toLowerCase())).size, [held.data]);

  function afterDecision(): void {
    held.reload();
    guesses.reload();
    places.reload();
    catalog.reload(); // a decision can create an item, which every dropdown needs to see
  }

  const tabs: Array<[Tab, string]> = [
    ['held', `Held${held.data ? ` (${heldGroups})` : ''}`],
    ['guesses', `Guesses${guesses.data ? ` (${guesses.data.length})` : ''}`],
    ['aliases', 'Wordings'],
    ['items', 'Items'],
    ['posts', 'Posts'],
  ];

  const loadError = held.error ?? guesses.error ?? catalog.error;
  return (
    <div className="inv-review">
      <div className="inv-tabbar">
        <div className="inv-tabs" role="tablist" aria-label="Review sections">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={afterDecision}>
          Refresh
        </button>
      </div>

      {loadError !== null && loadError !== undefined && (
        <p className="inv-error" role="alert">
          {describeError(loadError)}
        </p>
      )}

      {tab === 'held' &&
        (held.data ? (
          <HeldPanel adminKey={adminKey} items={items} held={held.data} placeNames={placeNames} onDone={afterDecision} />
        ) : (
          <p role="status">Loading…</p>
        ))}
      {tab === 'guesses' &&
        (guesses.data ? (
          <GuessesPanel adminKey={adminKey} items={items} guesses={guesses.data} onDone={afterDecision} />
        ) : (
          <p role="status">Loading…</p>
        ))}
      {tab === 'aliases' && <AliasesPanel adminKey={adminKey} items={items} />}
      {tab === 'items' && <ItemsPanel adminKey={adminKey} items={items} onChanged={catalog.reload} />}
      {tab === 'posts' && (places.data ? <PostsPanel adminKey={adminKey} places={places.data} /> : <p role="status">Loading…</p>)}
    </div>
  );
}
