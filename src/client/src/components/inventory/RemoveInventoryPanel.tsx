import { useState } from 'react';
import type { ReactElement } from 'react';
import type { DemandView, EntryView, HandoffView } from '../../contracts/inventory';
import KeyPrompt from './KeyPrompt';
import HandoffForm from './review/HandoffForm';

interface Props {
  inventory: EntryView[];
  /** Open needs elsewhere, per inventory entry, so a removal can say where it went. */
  demand: DemandView[];
  /** The coordinator key for this visit, once entered. */
  adminKey: string | null;
  onUnlock: (key: string) => void;
  onRemoved: (result: HandoffView) => void;
}

/**
 * "Remove inventory": take some of an item away because it was handed over or is gone. It shrinks the entry and
 * removes it at zero, so other places stop being pointed at it. It needs the coordinator key, since entries are
 * anonymous and anyone could otherwise empty a real listing.
 */
export default function RemoveInventoryPanel({ inventory, demand, adminKey, onUnlock, onRemoved }: Props): ReactElement {
  const [entryId, setEntryId] = useState('');

  if (adminKey === null) {
    return (
      <KeyPrompt
        reason="Removing inventory changes what other places see, so it needs the coordinator key."
        onUnlock={onUnlock}
      />
    );
  }
  if (inventory.length === 0) return <p className="meta">There is nothing in the inventory to remove.</p>;

  const entry = inventory.find((e) => e.id === entryId) ?? null;
  return (
    <div className="inv-form">
      <p className="meta">Take some of an item out of the inventory, because it was handed over or is gone.</p>
      <div>
        <label className="inv-label" htmlFor="remove-which">
          Which item?
        </label>
        <select id="remove-which" className="inv-input" value={entryId} onChange={(e) => setEntryId(e.target.value)}>
          <option value="">Choose…</option>
          {inventory.map((e) => (
            <option key={e.id} value={e.id}>
              {e.item.name} × {e.quantity}
            </option>
          ))}
        </select>
      </div>
      {entry && (
        <HandoffForm
          key={entry.id}
          adminKey={adminKey}
          entry={entry}
          needs={demand.find((d) => d.entry_id === entry.id)?.needed_at ?? []}
          submitLabel="Remove"
          onCancel={() => setEntryId('')}
          onDone={(result) => {
            setEntryId('');
            onRemoved(result);
          }}
        />
      )}
    </div>
  );
}
