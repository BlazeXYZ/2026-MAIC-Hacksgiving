import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { createAlias, describeError, getAliases, updateAlias } from '../../../api/inventory';
import type { ItemRef } from '../../../contracts/inventory';
import { useLoad } from '../util';

interface Props {
  adminKey: string;
  items: ItemRef[];
}

const STATUSES = ['', 'seeded', 'approved', 'rejected'] as const;

/** Every wording the system knows. Rename, remap to another item, reject, or restore. Only these are ever stored. */
export default function AliasesPanel({ adminKey, items }: Props): ReactElement {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('');
  const aliases = useLoad(() => getAliases(adminKey, status || undefined), [adminKey, status]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newText, setNewText] = useState('');
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      aliases.reload();
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!newText.trim() || !newItem) return;
    if (await run(() => createAlias(adminKey, newText.trim(), newItem))) setNewText('');
  }

  async function saveRename(id: string): Promise<void> {
    if (!draft.trim()) return;
    if (await run(() => updateAlias(adminKey, id, { text: draft.trim() }))) setEditingId(null);
  }

  return (
    <div className="inv-stack">
      <form className="card inv-inline" onSubmit={(e) => void add(e)} aria-label="Add a wording">
        <label className="inv-label" htmlFor="alias-new-text">
          Add a wording
        </label>
        <input
          id="alias-new-text"
          className="inv-input"
          value={newText}
          maxLength={80}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="for example: trash can"
          autoComplete="off"
        />
        <label className="inv-label" htmlFor="alias-new-item">
          Means
        </label>
        <select id="alias-new-item" className="inv-input" value={newItem} onChange={(e) => setNewItem(e.target.value)}>
          <option value="">Choose an item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn primary" disabled={busy || !newText.trim() || !newItem}>
          Add
        </button>
      </form>

      <div className="inv-inline">
        <label className="inv-label" htmlFor="alias-filter">
          Show
        </label>
        <select
          id="alias-filter"
          className="inv-input"
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All wordings'}
            </option>
          ))}
        </select>
        <span className="meta">{aliases.data ? `${aliases.data.length} shown` : ''}</span>
      </div>

      {error && (
        <p className="inv-error" role="alert">
          {error}
        </p>
      )}

      {!aliases.data ? (
        <p role="status">{aliases.error ? describeError(aliases.error) : 'Loading…'}</p>
      ) : (
        <table className="inv-table">
          <thead>
            <tr>
              <th scope="col">Wording</th>
              <th scope="col">Means</th>
              <th scope="col">Status</th>
              <th scope="col">In use</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {aliases.data.map((a) => (
              <tr key={a.id} className={a.status === 'rejected' ? 'off' : ''}>
                <td>
                  {editingId === a.id ? (
                    <input
                      className="inv-input"
                      aria-label={`New wording for ${a.text}`}
                      value={draft}
                      maxLength={80}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRename(a.id);
                      }}
                    />
                  ) : (
                    a.text
                  )}
                </td>
                <td>
                  <select
                    className="inv-input"
                    aria-label={`Item for ${a.text}`}
                    value={a.item.id}
                    disabled={busy}
                    onChange={(e) => void run(() => updateAlias(adminKey, a.id, { item_id: e.target.value }))}
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={a.status === 'rejected' ? 'tag urgent' : 'tag plain'}>{a.status}</span>
                </td>
                <td>{a.open_entries}</td>
                <td className="inv-rowact">
                  {editingId === a.id ? (
                    <>
                      <button type="button" className="btn sm primary" disabled={busy || !draft.trim()} onClick={() => void saveRename(a.id)}>
                        Save
                      </button>
                      <button type="button" className="btn sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(a.id);
                          setDraft(a.text);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busy}
                        onClick={() => void run(() => updateAlias(adminKey, a.id, { status: a.status === 'rejected' ? 'approved' : 'rejected' }))}
                      >
                        {a.status === 'rejected' ? 'Restore' : 'Reject'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
