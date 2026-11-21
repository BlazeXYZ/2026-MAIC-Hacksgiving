import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { describeError, postEntry } from '../../api/inventory';
import type { CatalogItem, EntryResult } from '../../contracts/inventory';
import { searchCatalog } from './search';

const MAX_TEXT = 120;
const MAX_CHIPS = 12;

interface Props {
  placeId: string;
  catalog: CatalogItem[];
  /** "need" adds to Requested items. "have" adds to Current inventory. */
  kind: 'need' | 'have';
  onPosted: () => void;
}

const COPY = {
  need: { title: 'Request an item', help: 'Ask the community for something this place needs.', button: 'Request' },
  have: { title: 'Give an item', help: 'Add something this place has, so others can see it is available.', button: 'Give' },
} as const;

/**
 * One field for both "Request item" and "Give item". Type what it is, or tap a suggestion. A tapped suggestion
 * always matches. Anything else is sent as typed and matched by the server, or held for a coordinator.
 */
export default function PostEntryForm({ placeId, catalog, kind, onPosted }: Props): ReactElement {
  const [text, setText] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EntryResult | null>(null);

  const found = useMemo(() => searchCatalog(catalog, text), [catalog, text]);
  const shown = found.slice(0, MAX_CHIPS);
  const guessing = text.trim() !== '' && found.length > 0 && found.every((f) => f.approximate);

  const qty = Number.parseInt(quantity, 10);
  const qtyOk = Number.isInteger(qty) && qty >= 1 && qty <= 10_000;
  const canSend = qtyOk && (itemId !== null || text.trim() !== '') && !busy;
  const copy = COPY[kind];
  const id = `post-${kind}-${placeId}`;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const base = { location_id: placeId, kind, quantity: qty };
      const res = await postEntry(itemId !== null ? { ...base, item_id: itemId } : { ...base, text: text.trim() });
      setResult(res);
      setText('');
      setItemId(null);
      setQuantity('1');
      onPosted();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inv-form" onSubmit={(e) => void submit(e)} aria-label={copy.title}>
      <p className="meta">{copy.help}</p>
      <div>
        <label className="inv-label" htmlFor={`${id}-item`}>
          What item?
        </label>
        <input
          id={`${id}-item`}
          className="inv-input"
          type="search"
          value={text}
          maxLength={MAX_TEXT}
          autoFocus
          autoComplete="off"
          placeholder="for example: blankets"
          onChange={(e) => {
            setText(e.target.value);
            setItemId(null); // editing the words un-picks a suggestion
          }}
        />
        {guessing && <p className="meta">Did you mean:</p>}
        <div className="inv-chips" role="group" aria-label="Suggestions">
          {shown.map(({ item }) => (
            <button
              key={item.id}
              type="button"
              className="inv-chip"
              aria-pressed={itemId === item.id}
              onClick={() => {
                setItemId(item.id);
                setText(item.name);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        {found.length > MAX_CHIPS && <p className="meta">Keep typing to narrow the list.</p>}
        {text.trim() !== '' && found.length === 0 && (
          <p className="meta">Not in the list. You can still send it. A coordinator will check it.</p>
        )}
        <p className="meta">Please don&rsquo;t include phone numbers or addresses.</p>
      </div>

      <div className="inv-row">
        <div>
          <label className="inv-label" htmlFor={`${id}-qty`}>
            How many?
          </label>
          <input
            id={`${id}-qty`}
            className="inv-input inv-qty"
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <button type="submit" className="btn primary" disabled={!canSend}>
          {busy ? 'Sending…' : copy.button}
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
                Added <b>{result.item.name}</b>.{' '}
              </>
            ) : null}
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
