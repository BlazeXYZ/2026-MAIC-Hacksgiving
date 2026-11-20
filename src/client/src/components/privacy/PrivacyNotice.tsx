import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../Icon';
import { useSurvey } from '../../state/survey';
import type { StringKey } from '../../i18n/strings';

/**
 * Green shield chip that opens the privacy explainer (#16). Sits in the ask screen's "Keep this private" row
 * and next to the status screen's phone-masking note.
 */
export function PrivacyBadge({ long = false }: { long?: boolean }) {
  const { t } = useSurvey();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="shield" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Icon name="shield" />
        {long ? (
          <span>{t('private.how')}</span>
        ) : (
          <>
            <span>{t('private.badge')}</span>
            <span className="visually-hidden">: {t('private.how')}</span>
          </>
        )}
      </button>
      <PrivacyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const POINTS: Array<{ icon: IconName; title: StringKey; body: StringKey }> = [
  { icon: 'phone', title: 'modal.p1.t', body: 'modal.p1.d' },
  { icon: 'user', title: 'modal.p2.t', body: 'modal.p2.d' },
  { icon: 'check', title: 'modal.p3.t', body: 'modal.p3.d' },
  { icon: 'eyeoff', title: 'modal.p4.t', body: 'modal.p4.d' },
];

/**
 * Bottom sheet in the mockup's style (grab handle, Newsreader headline, hairline rows).
 * Native <dialog>, so focus trapping, Esc and the backdrop come from the browser.
 */
export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useSurvey();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheetdlg"
      aria-labelledby="privacy-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // tap on the backdrop
      }}
    >
      <div className="grab" aria-hidden="true" />
      <div className="in">
        <h2 id="privacy-title">{t('modal.title')}</h2>
        <p className="lede">{t('modal.lede')}</p>
        <div className="card">
          {POINTS.map((p) => (
            <div className="kv" key={p.title}>
              <Icon name={p.icon} />
              <span>
                <b>{t(p.title)}</b>
                <small>{t(p.body)}</small>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="btn primary block" onClick={onClose} autoFocus>
          {t('modal.close')}
        </button>
      </div>
    </dialog>
  );
}
