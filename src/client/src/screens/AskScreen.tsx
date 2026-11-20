import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import type { TriageResult } from '../contracts';
import { previewTriage, submitSurvey, type Sampled } from '../api/intake';
import { LanguageSelector } from '../components/survey/LanguageSelector';
import { OtherTextInput } from '../components/survey/OtherTextInput';
import { DistrictPicker } from '../components/survey/DistrictPicker';
import { TriageReviewCard } from '../components/survey/TriageReviewCard';
import { PrivacyBadge } from '../components/privacy/PrivacyNotice';
import { NEEDS, freeTextProblem, toSurveyRequest, useSurvey } from '../state/survey';
import '../components/survey/survey.css';

type Step = 'language' | 'need' | 'district' | 'review';
const STEPS: Step[] = ['language', 'need', 'district', 'review'];

/**
 * The resident intake survey: language (#3) → need + words (#2 slot, #5) → area (#4) → review (#6).
 * Answers live in the survey context, so moving back and forth keeps them.
 */
export function AskScreen({ onSubmitted }: { onSubmitted: (token: string) => void }) {
  const { survey, update, t } = useSurvey();
  const [step, setStep] = useState<Step>('language');
  const [triage, setTriage] = useState<Sampled<TriageResult> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const index = STEPS.indexOf(step);

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => heading.current?.focus(), [step]);

  useEffect(() => {
    if (step !== 'review') return;
    let live = true;
    setTriage(null);
    setError(null);
    previewTriage(toSurveyRequest(survey))
      .then((r) => live && setTriage(r))
      .catch(() => live && setError(t('review.failed')));
    return () => {
      live = false;
    };
    // Re-run only when entering review; edits happen on earlier steps.
  }, [step]);

  const textProblem = freeTextProblem(survey.freeText, survey.need === 'other');
  const canNext = step === 'language' || (step === 'need' && survey.need !== null && !textProblem) || (step === 'district' && survey.district !== null);

  async function confirm() {
    if (!triage) return;
    setSending(true);
    setError(null);
    try {
      const accepted = await submitSurvey(toSurveyRequest(survey), triage);
      onSubmitted(accepted.token);
    } catch {
      setError(t('review.failed'));
      setSending(false);
    }
  }

  const titles: Record<Step, string> = {
    language: t('lang.title'),
    need: t('need.title'),
    district: t('district.title'),
    review: t('review.step'),
  };

  return (
    <main className="page stack" style={{ paddingTop: 24 }}>
      <div className="stepper">
        <div className="bars" aria-hidden="true">
          {STEPS.map((s, i) => (
            <i key={s} className={i <= index ? 'on' : undefined} />
          ))}
        </div>
        <span className="meta">{t('step.of', { n: index + 1, total: STEPS.length })}</span>
      </div>

      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p className="meta">{t('ask.kicker')}</p>
          <h1 className="title" ref={heading} tabIndex={-1} style={{ outline: 'none' }}>
            {titles[step]}
          </h1>
        </div>
        <PrivacyBadge />
      </header>

      {step === 'language' && (
        <>
          <LanguageSelector />
          <p className="meta">{t('lang.help')}</p>
        </>
      )}

      {step === 'need' && (
        <>
          <div className="tip">
            <Lightbulb aria-hidden="true" />
            <span>{t('ask.tip')}</span>
          </div>
          {/* Stand-in for the need cards from #2: same values, plain styling. */}
          <div className="need-slot" role="radiogroup" aria-label={t('need.title')}>
            {NEEDS.map((n) => (
              <button key={n} type="button" className="chip" role="radio" aria-checked={survey.need === n} onClick={() => update({ need: n })}>
                {t(`need.${n}`)}
              </button>
            ))}
          </div>
          <OtherTextInput open={survey.need !== null} required={survey.need === 'other'} />
        </>
      )}

      {step === 'district' && (
        <>
          <p style={{ color: 'var(--ink-2)' }}>{t('district.help')}</p>
          <DistrictPicker />
        </>
      )}

      {step === 'review' && (
        <>
          <TriageReviewCard triage={triage} sending={sending} error={error} onConfirm={() => void confirm()} onEdit={() => setStep('need')} />
          <div className="card setrow">
            <span>
              <b id="keep-private">{t('private.title')}</b>
              <small>{t('private.help')}</small>
            </span>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={survey.keepPrivate}
              aria-labelledby="keep-private"
              onClick={() => update({ keepPrivate: !survey.keepPrivate })}
            />
          </div>
        </>
      )}

      {step !== 'review' && (
        <div className="ask-foot">
          {index > 0 ? (
            <button type="button" className="btn" onClick={() => setStep(STEPS[index - 1])}>
              <ArrowLeft aria-hidden="true" />
              {t('nav.back')}
            </button>
          ) : null}
          <button
            type="button"
            className="btn primary"
            style={index === 0 ? { gridColumn: '1 / -1' } : undefined}
            disabled={!canNext}
            onClick={() => setStep(STEPS[index + 1])}
          >
            {t('nav.next')}
          </button>
        </div>
      )}
    </main>
  );
}
