import { useEffect, useState } from 'react';
import { Car, Coffee, MessageCircle, MoreHorizontal, Shield, Utensils } from 'lucide-react';
import type { SurveyAccepted, SurveyRequest, TriageResult } from '../contracts/intake';
import { previewTriage, submitSurvey, type Sampled } from '../api/intake';
import './HelpSurvey.css';

/** Ids are what the server's triage understands (`safe place`, `warm lobby` after normalizing) and what `NEED_CATEGORY` in `api/intake.ts` maps offline. */
const NEEDS = [
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'ride', label: 'Ride', icon: Car },
  { id: 'safe-place', label: 'Safe Place', icon: Shield },
  { id: 'warm-lobby', label: 'Warm Lobby', icon: Coffee },
  { id: 'talk', label: 'Talk to Someone', icon: MessageCircle },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
] as const;

type NeedId = (typeof NEEDS)[number]['id'];
type Step = 'choose' | 'review' | 'sent';

const URGENCY_LABEL: Record<TriageResult['urgency'], string> = {
  urgent: 'Urgent',
  today: 'Today',
  this_week: 'This week',
};

export default function HelpSurvey() {
  const [step, setStep] = useState<Step>('choose');
  const [needId, setNeedId] = useState<NeedId | null>(null);
  const [description, setDescription] = useState('');
  const [triage, setTriage] = useState<Sampled<TriageResult> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Sampled<SurveyAccepted> | null>(null);
  const need = NEEDS.find((choice) => choice.id === needId);

  const request: SurveyRequest | null = needId
    ? { selected_options: [needId], free_text: needId === 'other' ? description.trim() || null : null, district: null, language: 'en' }
    : null;

  // Ask for the triage summary when the review step opens. Falls back to a local guess if the server is down.
  useEffect(() => {
    if (step !== 'review' || !request) return;
    let cancelled = false;
    setTriage(null);
    previewTriage(request)
      .then((result) => !cancelled && setTriage(result))
      .catch(() => !cancelled && setError('We could not prepare your request. Please go back and try again.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function send() {
    if (!request || !triage || sending) return;
    setSending(true);
    setError(null);
    try {
      setAccepted(await submitSurvey(request, triage));
      setStep('sent');
    } catch {
      setError('Your request was not sent. Please try again, or call the ComForce hotline.');
    } finally {
      setSending(false);
    }
  }

  function startOver() {
    setStep('choose');
    setNeedId(null);
    setDescription('');
    setTriage(null);
    setAccepted(null);
    setError(null);
  }

  function backToChoices() {
    setStep('choose');
    setError(null);
  }

  return (
    <section className="help-survey" aria-labelledby="survey-heading">
      <h2 id="survey-heading">What kind of help do you need?</h2>
      <p>This is a demo. Use sample details. Please don&rsquo;t include phone numbers or addresses.</p>

      {step === 'sent' && accepted ? (
        <section className="help-survey-review" aria-labelledby="survey-sent-title">
          <h3 id="survey-sent-title" tabIndex={-1} ref={(heading) => heading?.focus()}>
            Request sent
          </h3>
          <p>
            Your request code is <strong className="help-survey-code">{accepted.token}</strong>. Save it. You can use it to check on your request.
          </p>
          <p>{accepted.summary}</p>
          {accepted.service && (
            <p>
              <strong>{accepted.service.name}.</strong> {accepted.service.next_step}
            </p>
          )}
          {accepted.sample && <p className="help-survey-note">Sample mode: the server wasn&rsquo;t reachable, so nothing was sent to ComForce.</p>}
          <button className="help-survey-action" type="button" onClick={startOver}>
            Make another request
          </button>
        </section>
      ) : step === 'review' && need ? (
        <section className="help-survey-review" aria-labelledby="survey-review-title" aria-busy={!triage}>
          <h3 id="survey-review-title" tabIndex={-1} ref={(heading) => heading?.focus()}>
            Review your request
          </h3>
          <p>{need.label}</p>
          {needId === 'other' && description.trim() && <p>{description.trim()}</p>}
          {triage ? (
            <p role="status">
              <strong>{URGENCY_LABEL[triage.urgency]}.</strong> {triage.summary}
            </p>
          ) : (
            !error && <p role="status">Preparing your request&hellip;</p>
          )}
          {error && (
            <p className="help-survey-error" role="alert">
              {error}
            </p>
          )}
          <button className="help-survey-action" type="button" disabled={!triage || sending} onClick={() => void send()}>
            {sending ? 'Sending…' : 'Send request'}
          </button>{' '}
          <button className="help-survey-action secondary" type="button" disabled={sending} onClick={backToChoices}>
            Back to choices
          </button>
        </section>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (needId && (needId !== 'other' || description.trim())) {
              setError(null);
              setStep('review');
            }
          }}
        >
          <fieldset>
            <legend>Choose one option</legend>
            <div className="help-survey-choices">
              {NEEDS.map(({ id, label, icon: Icon }) => (
                <label key={id} className="help-survey-choice">
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                  <input
                    type="radio"
                    name="need"
                    value={id}
                    checked={needId === id}
                    autoFocus={needId === id}
                    onChange={() => setNeedId(id)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          {needId === 'other' && (
            <label className="help-survey-description">
              Tell us what kind of help you need
              <textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          )}
          <button className="help-survey-action" type="submit" disabled={!needId || (needId === 'other' && !description.trim())}>
            Next
          </button>
        </form>
      )}
    </section>
  );
}
