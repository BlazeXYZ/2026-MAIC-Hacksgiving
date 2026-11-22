import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Check, Coffee, Copy, LocateFixed, MessageCircle, MoreHorizontal, Shield, Utensils } from 'lucide-react';
import type { SurveyAccepted, SurveyRequest, TriageResult } from '../contracts/intake';
import { previewTriage, submitSurvey, type Sampled } from '../api/intake';
import { postEntry } from '../api/inventory';
import { inventoryTextForNeed } from './inventory/sync';
import {
  DEFAULT_ORIGIN,
  loadHelpOptions,
  rankOptions,
  requestedLabel,
  type HelpOption,
  type NeedId,
  type Origin,
} from '../map/helpOptions';
import { directionsHref, telHref } from '../map/safePlaces';
import './HelpSurvey.css';

/** Ids are what the server's triage understands (`safe place`, `warm lobby` after normalizing) and what `NEED_CATEGORY` in `api/intake.ts` maps offline. */
const NEEDS = [
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'ride', label: 'Ride', icon: Car },
  { id: 'safe-place', label: 'Safe Place', icon: Shield },
  { id: 'warm-lobby', label: 'Warm Lobby', icon: Coffee },
  { id: 'talk', label: 'Talk to Someone', icon: MessageCircle },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
] as const satisfies ReadonlyArray<{ id: NeedId; label: string; icon: unknown }>;

/** Heading and helper text for the "pick a place" step, per need. */
const PICK_COPY: Record<Exclude<NeedId, 'other'>, { title: string; help: string }> = {
  food: { title: 'Food near you', help: 'Pick the pantry you want to go to. Open ones are listed first.' },
  ride: { title: 'Where do you need a ride to?', help: 'Pick a destination. A volunteer will plan the pickup with you.' },
  'safe-place': { title: 'Safe places near you', help: 'Pick where you would feel safest going. Staffed places can help right away.' },
  'warm-lobby': { title: 'Warm lobbies near you', help: 'Public lobbies and campus desks where you can get out of the cold.' },
  talk: { title: 'Someone to talk to', help: 'Pick who you would like to hear from. The hotline is answered around the clock.' },
};

type Step = 'choose' | 'pick' | 'describe' | 'review' | 'sent';

const URGENCY_LABEL: Record<TriageResult['urgency'], string> = {
  urgent: 'Urgent',
  today: 'Today',
  this_week: 'This week',
};

const NOTE_MAX = 500;

type OptionsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; options: HelpOption[]; sample: boolean };

interface HelpSurveyProps {
  onCheckStatus: (code: string) => void;
  onViewInventoryPlace?: (placeId: string) => void;
}

export default function HelpSurvey({ onCheckStatus, onViewInventoryPlace }: HelpSurveyProps) {
  const [step, setStep] = useState<Step>('choose');
  const [needId, setNeedId] = useState<NeedId | null>(null);
  const [choice, setChoice] = useState<HelpOption | null>(null);
  const [note, setNote] = useState('');
  const [optionsState, setOptionsState] = useState<OptionsState>({ kind: 'idle' });
  const [origin, setOrigin] = useState<Origin>(DEFAULT_ORIGIN);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [triage, setTriage] = useState<Sampled<TriageResult> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Sampled<SurveyAccepted> | null>(null);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const need = NEEDS.find((n) => n.id === needId);

  const request: SurveyRequest | null = useMemo(() => {
    if (!needId) return null;
    // The server reads any free text with its own classifier, which overrides the chosen need. So a request
    // for a specific place carries the place in `selected_options` only; free text is for the describe path.
    return {
      selected_options: choice ? [needId, requestedLabel(choice)] : [needId],
      free_text: choice ? null : note.trim() || null,
      district: choice?.district && choice.kind !== 'hotline' ? choice.district : null,
      language: 'en',
    };
  }, [needId, choice, note]);

  // Move keyboard and screen reader focus to the new step's heading, once per step.
  useEffect(() => {
    if (step !== 'choose') headingRef.current?.focus();
  }, [step]);

  // Load the choices for the selected need when the pick step opens.
  useEffect(() => {
    if (step !== 'pick' || !needId || needId === 'other') return;
    const ctrl = new AbortController();
    setOptionsState({ kind: 'loading' });
    loadHelpOptions(needId, ctrl.signal)
      .then((res) => setOptionsState({ kind: 'ready', options: res.options, sample: res.sample }))
      .catch(() => !ctrl.signal.aborted && setOptionsState({ kind: 'ready', options: [], sample: true }));
    return () => ctrl.abort();
  }, [step, needId]);

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
    // Only re-run when the resident reaches the review step, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const ranked = useMemo(() => (optionsState.kind === 'ready' ? rankOptions(optionsState.options, origin) : []), [optionsState, origin]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError('This device cannot share its location. Showing distances from downtown.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Used only to sort the list on this device. It is never sent to the server.
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: 'your location' });
        setLocating(false);
      },
      () => {
        setLocationError('We could not get your location. Showing distances from downtown.');
        setLocating(false);
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  function chooseNeed() {
    if (!needId) return;
    setChoice(null);
    setError(null);
    setStep(needId === 'other' ? 'describe' : 'pick');
  }

  function pickOption(option: HelpOption) {
    setChoice(option);
    setError(null);
    setStep('review');
  }

  async function send() {
    if (!request || !triage || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await submitSurvey(request, triage);
      setAccepted(result);
      if (choice) {
        const inventoryText = needId ? inventoryTextForNeed(needId, note) : null;
        if (inventoryText) {
          void postEntry({
            location_id: choice.id,
            kind: 'need',
            quantity: 1,
            text: inventoryText.slice(0, 200),
          }).catch(() => {
            // The help request has still been sent; inventory matching is best-effort.
          });
        }
      }
      setStep('sent');
    } catch {
      setError('Your request was not sent. Please try again, or call the ComForce hotline.');
    } finally {
      setSending(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt('Copy your request code:', code); // browsers without clipboard access
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startOver() {
    setStep('choose');
    setCopied(false);
    setNeedId(null);
    setChoice(null);
    setNote('');
    setTriage(null);
    setAccepted(null);
    setError(null);
    setOptionsState({ kind: 'idle' });
  }

  /** Back one step: review returns to the list (or the text box for "Other"), the list returns to the needs. */
  function back() {
    setError(null);
    if (step === 'review') setStep(needId === 'other' || !choice ? 'describe' : 'pick');
    else setStep('choose');
  }

  const needLabel = need?.label ?? '';

  return (
    <section className="help-survey" aria-labelledby="survey-heading">
      <h2 id="survey-heading">What kind of help do you need?</h2>
      <p>This is a demo. Use sample details. Please don&rsquo;t include phone numbers or addresses.</p>

      {step === 'sent' && accepted && (
        <section className="help-survey-review" aria-labelledby="survey-step-title">
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            Request sent
          </h3>
          <p>
            Your request code is <strong className="help-survey-code">{accepted.token}</strong>. Save it. You can use it to check on your request.
          </p>
          <button className="btn sm help-survey-copy" type="button" onClick={() => void copyCode(accepted.token)}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copied' : 'Copy code'}
          </button>
          <span className="help-survey-sr" role="status">
            {copied ? 'Request code copied to clipboard' : ''}
          </span>
          {choice && (
            <p>
              <strong>{choice.name}</strong>
              <br />
              {choice.address}
            </p>
          )}
          <p>{accepted.summary}</p>
          {choice ? (
            <p>A ComForce coordinator will review your request and follow up about this place. Use the links below to get directions or call ahead.</p>
          ) : (
            accepted.service && (
              <p>
                <strong>{accepted.service.name}.</strong> {accepted.service.next_step}
              </p>
            )
          )}
          {choice && <PlaceLinks option={choice} />}
          {choice && onViewInventoryPlace && (
            <button className="help-survey-action secondary" type="button" onClick={() => onViewInventoryPlace(choice.id)}>
              View this place&rsquo;s inventory
            </button>
          )}
          {accepted.sample && <p className="help-survey-note">Sample mode: the server wasn&rsquo;t reachable, so nothing was sent to ComForce.</p>}
          <button className="help-survey-action" type="button" onClick={() => onCheckStatus(accepted.token)}>
            Check request status
          </button>{' '}
          <button className="help-survey-action secondary" type="button" onClick={startOver}>
            Make another request
          </button>
        </section>
      )}

      {step === 'review' && need && (
        <section className="help-survey-review" aria-labelledby="survey-step-title" aria-busy={!triage}>
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            Review your request
          </h3>
          <p>
            <strong>{needLabel}</strong>
          </p>
          {choice && (
            <p>
              {choice.name}
              <br />
              <span className="help-option-meta">{choice.address}</span>
            </p>
          )}
          {!choice && note.trim() && <p>{note.trim()}</p>}
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
          <button className="help-survey-action secondary" type="button" disabled={sending} onClick={back}>
            Back
          </button>
        </section>
      )}

      {step === 'pick' && needId && needId !== 'other' && (
        <section aria-labelledby="survey-step-title" aria-busy={optionsState.kind !== 'ready'}>
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            {PICK_COPY[needId].title}
          </h3>
          <p className="help-survey-sub">{PICK_COPY[needId].help}</p>
          <div className="help-survey-tools">
            <button type="button" className="btn sm" onClick={useMyLocation} disabled={locating}>
              <LocateFixed size={16} aria-hidden="true" /> {locating ? 'Finding you…' : 'Sort by distance from me'}
            </button>
            <span className="help-option-meta">Distances from {origin.label}. Your location stays on this device.</span>
          </div>
          {locationError && (
            <p className="help-survey-error" role="alert">
              {locationError}
            </p>
          )}

          {optionsState.kind !== 'ready' ? (
            <p role="status">Finding places&hellip;</p>
          ) : (
            <>
              {optionsState.sample && <p className="help-survey-note">Sample mode: showing built-in example places because the server wasn&rsquo;t reachable.</p>}
              {ranked.length === 0 ? (
                <p role="status">We couldn&rsquo;t find any listed places for this. You can still describe what you need below.</p>
              ) : (
                <ul className="help-options">
                  {ranked.map(({ option, miles }) => (
                    <li key={option.id} className="help-option">
                      <div className="help-option-main">
                        <h4>{option.name}</h4>
                        <div className="help-option-tags">
                          {option.verified === false ? (
                            <span className="tag plain" style={{ fontStyle: 'italic', background: '#fef3c7', color: '#b45309' }}>
                              Sample listing
                            </span>
                          ) : (
                            <span className="tag plain" style={{ background: '#d1fae5', color: '#047857' }}>
                              Verified
                            </span>
                          )}
                          {option.openNow !== undefined && (
                            <span className={`tag ${option.openNow ? 'ai' : 'plain'}`}>{option.openNow ? 'Open now' : 'Closed now'}</span>
                          )}
                          {miles !== null && <span className="tag plain">{miles < 0.1 ? 'Under 0.1 mi' : `${miles.toFixed(1)} mi`}</span>}
                          {option.noIdRequired && <span className="tag plain">No ID needed</span>}
                          {option.staffed && option.kind !== 'pantry' && <span className="tag plain">Staffed</span>}
                        </div>
                        <p className="help-option-meta">{option.address}</p>
                        <p className="help-option-meta">{option.hours}</p>
                      </div>
                      <div className="help-option-actions">
                        <button type="button" className="btn primary sm" onClick={() => pickOption(option)} aria-label={`Request ${option.name}`}>
                          Request this one
                        </button>
                        <PlaceLinks option={option} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button className="help-survey-action secondary" type="button" onClick={() => setStep('describe')}>
            None of these. Let me describe it
          </button>{' '}
          <button className="help-survey-action secondary" type="button" onClick={back}>
            Back
          </button>
        </section>
      )}

      {step === 'describe' && needId && (
        <form
          aria-labelledby="survey-step-title"
          onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) return;
            setChoice(null);
            setError(null);
            setStep('review');
          }}
        >
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            Tell us what kind of help you need
          </h3>
          <label className="help-survey-description">
            What do you need? ({needLabel})
            <textarea rows={3} maxLength={NOTE_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="help-survey-action" type="submit" disabled={!note.trim()}>
            Next
          </button>{' '}
          <button className="help-survey-action secondary" type="button" onClick={() => setStep(needId === 'other' ? 'choose' : 'pick')}>
            Back
          </button>
        </form>
      )}

      {step === 'choose' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            chooseNeed();
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
          <button className="help-survey-action" type="submit" disabled={!needId}>
            Next
          </button>
        </form>
      )}
    </section>
  );
}

/** Directions and call links for one place. Both open outside the app. */
function PlaceLinks({ option }: { option: HelpOption }) {
  const hasMap = option.latitude !== null && option.longitude !== null;
  return (
    <>
      {hasMap && (
        <a className="btn sm" href={directionsHref({ latitude: option.latitude as number, longitude: option.longitude as number })} target="_blank" rel="noreferrer">
          Directions
        </a>
      )}
      {option.phone && (
        <a className="btn sm" href={telHref(option.phone)}>
          Call {option.phone}
        </a>
      )}
    </>
  );
}
