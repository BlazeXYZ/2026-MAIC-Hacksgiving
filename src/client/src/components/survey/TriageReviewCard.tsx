import type { TriageResult, UrgencyLevel } from '../../contracts';
import { Icon } from '../Icon';
import { DISTRICTS, NEEDS, useSurvey, type Need } from '../../state/survey';
import { DistrictChips } from './DistrictPicker';

export const URGENCY_CLASS: Record<UrgencyLevel, string> = { urgent: 'urgent', today: 'today', this_week: 'week' };

export type FixTarget = 'need' | 'area' | null;

interface Props {
  /** `null` while the triage call is in flight. */
  triage: (TriageResult & { sample?: boolean }) | null;
  /** Hide the buttons once the request has been sent. */
  settled: boolean;
  sending: boolean;
  error: string | null;
  fixing: FixTarget;
  onFix: (target: FixTarget) => void;
  onConfirm: () => void;
  onEdit: () => void;
}

/**
 * "Here's what I understood. Tap to fix." (#6), drawn as the mockup's reply bubble. The tags are what the
 * AI picked up; tapping the need or area tag lets the resident correct it in place. The summary is set in
 * Newsreader italic, the one style reserved for the AI explaining itself.
 */
export function TriageReviewCard({ triage, settled, sending, error, fixing, onFix, onConfirm, onEdit }: Props) {
  const { survey, update, t } = useSurvey();
  const district = DISTRICTS.find((d) => d.id === survey.district);

  return (
    <div className="bubble hub" role="group" aria-label={t('review.title')} aria-busy={!triage}>
      <span className="meta">{t('review.title')}</span>

      {!triage ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 10, minWidth: 220 }} role="status">
          <span className="visually-hidden">{t('review.loading')}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <i className="skeleton" style={{ width: 64, height: 28 }} />
            <i className="skeleton" style={{ width: 80, height: 28 }} />
            <i className="skeleton" style={{ width: 56, height: 28 }} />
          </span>
          <i className="skeleton" />
          <i className="skeleton" style={{ width: '70%' }} />
        </div>
      ) : (
        <>
          <div className="heard">
            <span className={`tag ${URGENCY_CLASS[triage.urgency]} fixed`}>{t(`urgency.${triage.urgency}`)}</span>
            <button type="button" className="tag ai" disabled={settled} onClick={() => onFix(fixing === 'need' ? null : 'need')} aria-expanded={fixing === 'need'}>
              {t(`category.${triage.category}`)}
              {!settled && <Icon name="x" />}
            </button>
            {district && (
              <button type="button" className="tag ai" disabled={settled} onClick={() => onFix(fixing === 'area' ? null : 'area')} aria-expanded={fixing === 'area'}>
                {district.name}
                {!settled && <Icon name="x" />}
              </button>
            )}
          </div>

          {fixing === 'need' && (
            <div style={{ marginTop: 12 }}>
              <span className="meta">{t('review.fixneed')}</span>
              <div className="chips">
                {NEEDS.map((n: Need) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    aria-pressed={survey.need === n}
                    onClick={() => {
                      update({ need: n });
                      onFix(null);
                    }}
                  >
                    {t(`need.${n}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {fixing === 'area' && (
            <div style={{ marginTop: 12 }}>
              <span className="meta">{t('review.fixarea')}</span>
              <DistrictChips onPick={() => onFix(null)} />
            </div>
          )}

          <p className="why">{triage.summary}</p>
          {triage.sample && (
            <p className="meta" style={{ marginTop: 8 }}>
              {t('sample')}
            </p>
          )}
        </>
      )}

      {error && (
        <p className="field-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {!settled && (
        <div className="bubble-acts">
          <button type="button" className="btn primary" disabled={!triage || sending} onClick={onConfirm}>
            {sending ? t('review.sending') : t('review.confirm')}
          </button>
          <button type="button" className="btn" disabled={sending} onClick={onEdit}>
            {t('review.edit')}
          </button>
        </div>
      )}
    </div>
  );
}
