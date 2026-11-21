import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { describeError, handoffEntry } from '../../../api/inventory';
import type { EntryView, HandoffView, SourceView } from '../../../contracts/inventory';

interface Props {
  adminKey: string;
  /** The stock or offer being passed over. */
  entry: EntryView;
  /** Open needs elsewhere for this same item, nearest first. */
  needs: SourceView[];
  onDone: (result: HandoffView) => void;
  onCancel: () => void;
}

/** Record that some of a stock or offer was passed over, and optionally which need it went to. */
export default function HandoffForm({ adminKey, entry, needs, onDone, onCancel }: Props): ReactElement {
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [needId, setNeedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = Number.parseInt(quantity, 10);
  const valid = Number.isInteger(qty) && qty >= 1 && qty <= entry.quantity;
  const id = `ho-${entry.id}`;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await handoffEntry(adminKey, entry.id, { quantity: qty, ...(needId ? { to_need_id: needId } : {}) }));
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <form className="inv-handoff" onSubmit={(e) => void submit(e)} aria-label={`Pass over ${entry.item.name}`}>
      <div>
        <label className="inv-label" htmlFor={`${id}-qty`}>
          How many were passed over? (up to {entry.quantity})
        </label>
        <input
          id={`${id}-qty`}
          className="inv-input inv-qty"
          type="number"
          min={1}
          max={entry.quantity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div>
        <label className="inv-label" htmlFor={`${id}-to`}>
          Where did it go? (optional)
        </label>
        <select id={`${id}-to`} className="inv-input" value={needId} onChange={(e) => setNeedId(e.target.value)}>
          <option value="">Not recorded</option>
          {needs.map((n) => (
            <option key={n.entry_id} value={n.entry_id}>
              {n.location}, needs {n.quantity}
            </option>
          ))}
        </select>
        <p className="meta">
          {needs.length === 0 ? 'No open need for this item elsewhere.' : 'Picking a need lowers it too, and closes it once covered.'}
        </p>
      </div>
      {error && (
        <p className="inv-error" role="alert">
          {error}
        </p>
      )}
      <div className="inv-actions">
        <button type="submit" className="btn primary sm" disabled={!valid || busy}>
          {busy ? 'Saving…' : 'Record hand-off'}
        </button>
        <button type="button" className="btn sm" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
