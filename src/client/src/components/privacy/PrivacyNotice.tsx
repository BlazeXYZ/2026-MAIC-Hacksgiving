import { useEffect, useId, useRef, useState } from 'react';
import { BadgeCheck, EyeOff, PhoneOff, ShieldCheck, UserRound } from 'lucide-react';
import { useSurvey } from '../../state/survey';
import './privacy.css';

/**
 * Shield badge that opens the privacy explainer (#16). Used on the request form and the status screen.
 * The native dialog traps focus and provides a backdrop.
 */
export function PrivacyBadge() {
  const { t } = useSurvey();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="privacy-badge" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <ShieldCheck aria-hidden="true" />
        <span>{t('private.badge')}</span>
      </button>
      <PrivacyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const POINTS = [
  { icon: PhoneOff, title: 'modal.p1.t', body: 'modal.p1.d' },
  { icon: UserRound, title: 'modal.p2.t', body: 'modal.p2.d' },
  { icon: BadgeCheck, title: 'modal.p3.t', body: 'modal.p3.d' },
  { icon: EyeOff, title: 'modal.p4.t', body: 'modal.p4.d' },
] as const;

export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useSurvey();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="privacy-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
    >
      <div className="privacy-body">
        <ShieldCheck className="privacy-mark" aria-hidden="true" />
        <h2 id={titleId} className="title">
          {t('modal.title')}
        </h2>
        <p className="privacy-lede">{t('modal.lede')}</p>
        <ul className="privacy-points">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon aria-hidden="true" />
              <span>
                <b>{t(title)}</b>
                <small>{t(body)}</small>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn primary block" onClick={onClose} autoFocus>
          {t('modal.close')}
        </button>
      </div>
    </dialog>
  );
}
