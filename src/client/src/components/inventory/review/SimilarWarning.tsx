import type { ReactElement } from 'react';
import type { ItemRef, SimilarItemsDetail } from '../../../contracts/inventory';

interface Props {
  detail: SimilarItemsDetail;
  busy: boolean;
  /** The coordinator decided it is another name for an existing item. */
  onSame: (item: ItemRef) => void;
  /** The coordinator decided it really is new. */
  onConfirmNew: () => void;
}

/**
 * Shown when the server refuses a "new" item because it looks like one we already have. The coordinator
 * either points to the existing item (a new name for it) or confirms it is genuinely new.
 */
export default function SimilarWarning({ detail, busy, onSame, onConfirmNew }: Props): ReactElement {
  return (
    <div className="inv-warn" role="alert">
      <b>This looks like something we already have.</b>
      <ul className="inv-list">
        {detail.similar.map((s) => (
          <li key={s.item.id}>
            <span>
              <b>{s.item.name}</b> <span className="meta">(similar to &ldquo;{s.wording}&rdquo;)</span>
            </span>
            <button type="button" className="btn sm" disabled={busy} onClick={() => onSame(s.item)}>
              Same as this
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn sm danger" disabled={busy} onClick={onConfirmNew}>
        It really is new. Create it
      </button>
    </div>
  );
}
