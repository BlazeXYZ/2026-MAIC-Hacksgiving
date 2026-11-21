import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { KIND_LABEL } from '../../../api/inventory';
import type { GuessView, ItemRef, UnresolvedView } from '../../../contracts/inventory';
import DecisionCard from './DecisionCard';

interface HeldProps {
  adminKey: string;
  items: ItemRef[];
  held: UnresolvedView[];
  placeNames: Record<string, string>;
  onDone: () => void;
}

function describe(rows: UnresolvedView[], placeNames: Record<string, string>): string {
  const parts = rows.slice(0, 3).map((r) => `${KIND_LABEL[r.kind]} ${r.quantity} at ${placeNames[r.location_id] ?? 'a place'}`);
  const more = rows.length > 3 ? ` and ${rows.length - 3} more` : '';
  return `${rows.length} ${rows.length === 1 ? 'post' : 'posts'} waiting: ${parts.join('; ')}${more}`;
}

/** Wordings the system could not place. Needs and donations of the same wording are settled together. */
export function HeldPanel({ adminKey, items, held, placeNames, onDone }: HeldProps): ReactElement {
  const groups = useMemo(() => {
    const byWording = new Map<string, UnresolvedView[]>();
    for (const row of held) {
      const key = row.label.trim().toLowerCase();
      byWording.set(key, [...(byWording.get(key) ?? []), row]);
    }
    return [...byWording.values()];
  }, [held]);

  if (groups.length === 0) return <p className="meta">Nothing is waiting for review.</p>;
  return (
    <div className="inv-stack">
      {groups.map((rows) => (
        <DecisionCard
          key={rows[0].id}
          adminKey={adminKey}
          items={items}
          entryId={rows[0].id}
          wording={rows[0].label}
          summary={describe(rows, placeNames)}
          candidates={rows[0].candidates}
          noneFit={rows[0].none_fit}
          similar={rows[0].similar}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

interface GuessProps {
  adminKey: string;
  items: ItemRef[];
  guesses: GuessView[];
  onDone: () => void;
}

/** Matches the system made on its own. Nothing is stored until a coordinator confirms one. */
export function GuessesPanel({ adminKey, items, guesses, onDone }: GuessProps): ReactElement {
  if (guesses.length === 0) return <p className="meta">No unconfirmed matches.</p>;
  return (
    <div className="inv-stack">
      {guesses.map((g) => (
        <DecisionCard
          key={g.entry_id}
          adminKey={adminKey}
          items={items}
          entryId={g.entry_id}
          wording={g.wording}
          summary={`${g.count} ${g.count === 1 ? 'post is' : 'posts are'} using this match, and it is not stored anywhere yet`}
          badge={g.via === 'model' ? 'Model match' : 'Spelling match'}
          candidates={g.candidates}
          noneFit={null}
          similar={[]}
          suggested={g.item}
          onDone={onDone}
        />
      ))}
    </div>
  );
}
