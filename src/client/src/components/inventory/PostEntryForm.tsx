import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { describeError, postEntry } from '../../api/inventory';
import type { CatalogItem, EntryKind, EntryResult } from '../../contracts/inventory';
import { searchCatalog } from './search';

const KINDS: Array<{ id: EntryKind; label: string; help: string }> = [
  { id: 'need', label: 'We need', help: 'Ask the community for something.' },
  { id: 'have', label: 'We have', help: 'List what is in stock here.' },
  { id: 'offer', label: 'Someone is offering', help: 'A donation on its way to this place.' },
];

const MAX_TEXT = 120;

interface Props {
  placeId: string;
  catalog: CatalogItem[];
  onPosted: () => void;
}

/**
 * Post a need, stock, or offer. People either pick an item from the shared list, which always matches,
 * or describe it in their own words and let the system match it.
 */
export default function PostEntryForm({ placeId, catalog, onPosted }: Props): ReactElement {
  const [kind, setKind] = useState<EntryKind>('need');
  const [mode, setMode] = useState<'pick' | 'describe'>('pick');
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EntryResult | null>(null);

  const shown = useMemo(() => searchCatalog(catalog, search), [catalog, search]);
  const guessing = search.trim() !== '' && shown.length > 0 && shown.every((f) => f.approximate);

  const qty = Number.parseInt(quantity, 10);
  const qtyOk = Number.isInteger(qty) && qty >= 1 && qty <= 10_000;
  const named = mode === 'pick' ? itemId !== null : text.trim().length > 0;
  const canPost = qtyOk && named && !busy;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canPost) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const base = { location_id: placeId, kind, quantity: qty };
      const res = await postEntry(mode === 'pick' ? { ...base, item_id: itemId as string } : { ...base, text: text.trim() });
      setResult(res);
      setItemId(null);
      setText('');
      setQuantity('1');
      onPosted();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inv-form" onSubmit={(e) => void submit(e)} aria-label="Post to this place">
      <fieldset>
        <legend>What are you posting?</legend>
        <div className="inv-seg" role="radiogroup">
          {KINDS.map((k) => (
            <label key={k.id} className={kind === k.id ? 'on' : ''}>
              <input type="radio" name={`kind-${placeId}`} checked={kind === k.id} onChange={() => setKind(k.id)} />
              <span>{k.label}</span>
            </label>
          ))}
        </div>
        <p className="meta">{KINDS.find((k) => k.id === kind)?.help}</p>
      </fieldset>

      <div className="inv-tabs" role="tablist" aria-label="How to name the item">
        <button type="button" role="tab" aria-selected={mode === 'pick'} onClick={() => setMode('pick')}>
          Pick from the list
        </button>
        <button type="button" role="tab" aria-selected={mode === 'describe'} onClick={() => setMode('describe')}>
          Describe it
        </button>
      </div>

      {mode === 'pick' ? (
        <div>
          <label className="inv-label" htmlFor={`search-${placeId}`}>
            Find an item
          </label>
          <input
            id={`search-${placeId}`}
            className="inv-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="coats, formula, bus pass…"
          />
          {guessing && <p className="meta">No exact match. Did you mean:</p>}
          <div className="inv-chips" role="group" aria-label="Items">
            {shown.map(({ item }) => (
              <button
                key={item.id}
                type="button"
                className="inv-chip"
                aria-pressed={itemId === item.id}
                onClick={() => setItemId(item.id)}
              >
                {item.name}
              </button>
            ))}
            {shown.length === 0 && (
              <p className="meta">
                Nothing close. You can{' '}
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setText(search.trim().slice(0, MAX_TEXT));
                    setMode('describe');
                  }}
                >
                  describe &ldquo;{search.trim()}&rdquo; in your own words
                </button>{' '}
                and a coordinator will check it.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <label className="inv-label" htmlFor={`text-${placeId}`}>
            What is it?
          </label>
          <input
            id={`text-${placeId}`}
            className="inv-input"
            value={text}
            maxLength={MAX_TEXT}
            onChange={(e) => setText(e.target.value)}
            placeholder="for example: baby crib"
            autoComplete="off"
          />
          <p className="meta">
            Use a few words. Please don&rsquo;t include phone numbers or addresses. If we can&rsquo;t tell what it is, a
            coordinator will check it.
          </p>
        </div>
      )}

      <div className="inv-row">
        <div>
          <label className="inv-label" htmlFor={`qty-${placeId}`}>
            How many?
          </label>
          <input
            id={`qty-${placeId}`}
            className="inv-input inv-qty"
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <button type="submit" className="btn primary" disabled={!canPost}>
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div aria-live="polite">
        {error && (
          <p className="inv-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="inv-ok" role="status">
            {result.status === 'matched' && result.item ? (
              <>
                Posted as <b>{result.item.name}</b>.{' '}
              </>
            ) : null}
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
