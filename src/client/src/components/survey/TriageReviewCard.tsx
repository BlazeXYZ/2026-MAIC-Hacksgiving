import { Pencil, Sparkles } from 'lucide-react';
import type { TriageResult, UrgencyLevel } from '../../contracts/intake';
import { DISTRICTS, useSurvey } from '../../state/survey';

export const URGENCY_CLASS: Record<UrgencyLevel, string> = { urgent: 'urgent', today: 'today', this_week: 'week' };

interface Props {
  /** `null` while the triage call is in flight. */
  triage: (TriageResult & { sample?: boolean }) | null;
  sending: boolean;
  error: string | null;
  onConfirm: () => void;
  onEdit: () => void;
}

/**
 * "Here's what we understood" (#6). The model's words are set in Newsreader italic, the one style
 * the v9 mockup reserves for the AI explaining itself. One tap confirms; Edit goes back with the text kept.
 */
export function TriageReviewCard({ triage, sending, error, onConfirm, onEdit }: Props) {
  const { survey, t } = useSurvey();
  const district = DISTRICTS.find((d) => d.id === survey.district);

  return (
    <section className="card review" aria-labelledby="review-title" aria-busy={!triage && !error}>
      <h4 id="review-title" className="kicker" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Sparkles aria-hidden="true" size={14} />
        {t('review.title')}
      </h4>

      {!triage && !error && (
        <div className="review-skel" role="status">
          <p className="meta">{t('review.loading')}</p>
          <div className="skeleton" aria-hidden="true" />
          <div className="skeleton" style={{ width: '60%' }} aria-hidden="true" />
        </div>
      )}
      {triage && (
        <>
          <div className="review-tags">
            <span className={`tag ${URGENCY_CLASS[triage.urgency]}`}>{t(`urgency.${triage.urgency}`)}</span>
            <span className="tag ai">{t(`category.${triage.category}`)}</span>
            {district && <span className="tag ai">{district.name}</span>}
            {triage.sample && <span className="meta">{t('sample')}</span>}
          </div>
          <p className="why">{triage.summary}</p>
          <p className="meta">{t('review.fix')}</p>
        </>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="review-actions">
        <button type="button" className="btn primary" disabled={!triage || sending} onClick={onConfirm}>
          {sending ? t('review.sending') : t('review.confirm')}
        </button>
        <button type="button" className="btn" disabled={sending} onClick={onEdit}>
          <Pencil aria-hidden="true" />
          {t('review.edit')}
        </button>
      </div>
    </section>
  );
}
