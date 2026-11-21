import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { createItem, describeError, renameItem, similarItemsFrom } from '../../../api/inventory';
import type { ItemRef, SimilarItemsDetail } from '../../../contracts/inventory';
import SimilarWarning from './SimilarWarning';

interface Props {
  adminKey: string;
  items: ItemRef[];
  onChanged: () => void;
}

/** The shared item list. Rename an item, or add one the starter list does not have. */
export default function ItemsPanel({ adminKey, items, onChanged }: Props): ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [warning, setWarning] = useState<SimilarItemsDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(id: string): Promise<void> {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renameItem(adminKey, id, draft.trim());
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function add(confirmNew: boolean): Promise<void> {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const extra = aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      await createItem(adminKey, { name: name.trim(), aliases: extra, ...(confirmNew ? { confirm_new: true } : {}) });
      setName('');
      setAliases('');
      setWarning(null);
      onChanged();
    } catch (err) {
      const similar = similarItemsFrom(err);
      if (similar) setWarning(similar);
      else setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    void add(false);
  }

  return (
    <div className="inv-stack">
      <form className="card inv-decision" onSubmit={submit} aria-label="Add an item">
        <h3>Add an item</h3>
        <label className="inv-label" htmlFor="item-new-name">
          Name
        </label>
        <input
          id="item-new-name"
          className="inv-input"
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            setWarning(null);
          }}
          autoComplete="off"
        />
        <label className="inv-label" htmlFor="item-new-aliases">
          Other wordings for it, separated by commas (optional)
        </label>
        <input
          id="item-new-aliases"
          className="inv-input"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          autoComplete="off"
        />
        {warning && (
          <SimilarWarning
            detail={warning}
            busy={busy}
            onSame={() => {
              setWarning(null);
              setError('Use the Aliases tab to add it as another wording for that item.');
            }}
            onConfirmNew={() => void add(true)}
          />
        )}
        <div className="inv-actions">
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            Add item
          </button>
        </div>
      </form>

      {error && (
        <p className="inv-error" role="alert">
          {error}
        </p>
      )}

      <ul className="inv-list card inv-group">
        {items.map((item) => (
          <li key={item.id}>
            {editingId === item.id ? (
              <input
                className="inv-input"
                aria-label={`New name for ${item.name}`}
                value={draft}
                maxLength={80}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void rename(item.id);
                }}
              />
            ) : (
              <span>
                <b>{item.name}</b> <span className="meta">{item.id}</span>
              </span>
            )}
            <span className="inv-rowact">
              {editingId === item.id ? (
                <>
                  <button type="button" className="btn sm primary" disabled={busy || !draft.trim()} onClick={() => void rename(item.id)}>
                    Save
                  </button>
                  <button type="button" className="btn sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setEditingId(item.id);
                    setDraft(item.name);
                  }}
                >
                  Rename
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
