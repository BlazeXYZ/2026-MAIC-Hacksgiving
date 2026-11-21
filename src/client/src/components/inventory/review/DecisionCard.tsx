import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { describeError, promoteEntry, resolveEntry, similarItemsFrom } from '../../../api/inventory';
import type { CandidateView, ItemRef, SimilarItemsDetail, SimilarView } from '../../../contracts/inventory';
import { percent } from '../util';
import SimilarWarning from './SimilarWarning';

interface Props {
  adminKey: string;
  /** Every catalog item, for "choose a different item". */
  items: ItemRef[];
  /** One entry with this wording. The server settles every entry that shares it. */
  entryId: string;
  wording: string;
  summary: string;
  badge?: string;
  candidates: CandidateView[];
  noneFit: number | null;
  similar: SimilarView[];
  /** For a guess the system already made. */
  suggested?: ItemRef | null;
  onDone: () => void;
}

interface Option {
  item: ItemRef;
  note: string;
}

/** The decision for one wording: which existing item is it, or is it a new item? */
export default function DecisionCard(props: Props): ReactElement {
  const { adminKey, items, entryId, wording, summary, badge, candidates, noneFit, similar, suggested, onDone } = props;

  const options = useMemo<Option[]>(() => {
    const found = new Map<string, Option>();
    const add = (item: ItemRef, note: string): void => {
      const prior = found.get(item.id);
      found.set(item.id, { item, note: prior ? `${prior.note}; ${note}` : note });
    };
    if (suggested) add(suggested, 'current guess');
    candidates.forEach((c) => add(c.item, c.probability === null ? 'model pick' : `${percent(c.probability)} likely`));
    similar.forEach((s) => add(s.item, `spelled like “${s.wording}”`));
    return [...found.values()];
  }, [suggested, candidates, similar]);

  // Preselect only what is safe to preselect: the guess already in use, or a candidate the model beat "None fit" with.
  // Otherwise the coordinator has to choose on purpose, so a wrong default is never one click from being saved.
  const [selected, setSelected] = useState<string>(() => {
    if (suggested) return suggested.id;
    const top = candidates[0];
    if (!top) return '';
    const modelUnsure = noneFit !== null && (top.probability ?? 1) <= noneFit;
    return modelUnsure ? '' : top.item.id;
  });
  const [alias, setAlias] = useState('');
  const [mode, setMode] = useState<'confirm' | 'new'>('confirm');
  const [newName, setNewName] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [warning, setWarning] = useState<SimilarItemsDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedName = items.find((i) => i.id === selected)?.name;
  const id = `dc-${entryId}`;

  async function confirm(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resolveEntry(adminKey, entryId, selected, alias);
      onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function create(confirmNew: boolean): Promise<void> {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await promoteEntry(adminKey, entryId, {
        name: newName.trim(),
        ...(newAlias.trim() ? { alias_text: newAlias.trim() } : {}),
        ...(confirmNew ? { confirm_new: true } : {}),
      });
      onDone();
    } catch (err) {
      const similarItems = similarItemsFrom(err);
      if (similarItems) setWarning(similarItems);
      else setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function sameAs(item: ItemRef): void {
    setSelected(item.id);
    setAlias(newName.trim()); // the wording they were about to add as a new item becomes a name for this one
    setWarning(null);
    setMode('confirm');
  }

  return (
    <article className="card inv-decision" aria-label={`Decide: ${wording}`}>
      <header>
        <div>
          <span className="inv-wording">&ldquo;{wording}&rdquo;</span>
          {badge && <span className="tag held">{badge}</span>}
        </div>
        <p className="meta">{summary}</p>
      </header>

      {mode === 'confirm' ? (
        <form onSubmit={(e) => void confirm(e)}>
          <fieldset>
            <legend>Which item is this?</legend>
            {options.length === 0 ? (
              <p className="meta">The system has no suggestion for this one.</p>
            ) : (
              <div className="inv-options">
                {options.map((o) => (
                  <label key={o.item.id} className={selected === o.item.id ? 'on' : ''}>
                    <input type="radio" name={id} checked={selected === o.item.id} onChange={() => setSelected(o.item.id)} />
                    <span>
                      <b>{o.item.name}</b> <span className="meta">{o.note}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {noneFit !== null && noneFit > 0 && (
              <p className="meta">The model put {percent(noneFit)} on &ldquo;none of these fit&rdquo;.</p>
            )}
            <label className="inv-label" htmlFor={`${id}-other`}>
              Or choose a different item
            </label>
            <select id={`${id}-other`} className="inv-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Choose…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </fieldset>

          <label className="inv-label" htmlFor={`${id}-alias`}>
            Correct wording to remember (optional)
          </label>
          <input
            id={`${id}-alias`}
            className="inv-input"
            value={alias}
            maxLength={80}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="for example: trash can"
            autoComplete="off"
          />
          <p className="meta">
            You type this, so a misspelling is never saved. Leave it blank to settle these entries without teaching
            anything.
          </p>

          <div className="inv-actions">
            <button type="submit" className="btn primary" disabled={!selected || busy}>
              {busy ? 'Saving…' : selectedName ? `Confirm as ${selectedName}` : 'Choose an item'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setMode('new')}>
              This is a new item
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create(false);
          }}
        >
          <label className="inv-label" htmlFor={`${id}-name`}>
            Name of the new item
          </label>
          <input
            id={`${id}-name`}
            className="inv-input"
            value={newName}
            maxLength={80}
            onChange={(e) => {
              setNewName(e.target.value);
              setWarning(null);
            }}
            placeholder="a clean name, spelled correctly"
            autoComplete="off"
          />
          <label className="inv-label" htmlFor={`${id}-newalias`}>
            One more wording for it (optional)
          </label>
          <input
            id={`${id}-newalias`}
            className="inv-input"
            value={newAlias}
            maxLength={80}
            onChange={(e) => setNewAlias(e.target.value)}
            autoComplete="off"
          />
          {warning && <SimilarWarning detail={warning} busy={busy} onSame={sameAs} onConfirmNew={() => void create(true)} />}
          <div className="inv-actions">
            <button type="submit" className="btn primary" disabled={!newName.trim() || busy}>
              {busy ? 'Saving…' : 'Create item and settle'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setMode('confirm');
                setWarning(null);
              }}
            >
              Back
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="inv-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
