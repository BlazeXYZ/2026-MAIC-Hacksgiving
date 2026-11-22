import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { DISTRICTS, FREE_TEXT_MAX, freeTextProblem, useSurvey } from '../state/survey';
import { PrivacyBadge } from './privacy/PrivacyNotice';
import { DistrictPicker } from './survey/DistrictPicker';
import { LanguageSelector } from './survey/LanguageSelector';
import { TriageReviewCard } from './survey/TriageReviewCard';
import './HelpSurvey.css';

/** Ids are what the server's triage understands (`safe place`, `warm lobby` after normalizing) and what `NEED_CATEGORY` in `api/intake.ts` maps offline. */
const NEEDS = [
  { id: 'food', label: 'need.food', icon: Utensils },
  { id: 'ride', label: 'need.ride', icon: Car },
  { id: 'safe-place', label: 'need.safe', icon: Shield },
  { id: 'warm-lobby', label: 'need.warm', icon: Coffee },
  { id: 'talk', label: 'need.talk', icon: MessageCircle },
  { id: 'other', label: 'need.other', icon: MoreHorizontal },
] as const satisfies ReadonlyArray<{ id: NeedId; label: string; icon: unknown }>;

type Step = 'choose' | 'pick' | 'describe' | 'review' | 'sent';

type OptionsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; options: HelpOption[]; sample: boolean };

interface HelpSurveyProps {
  onCheckStatus: (code: string) => void;
  onViewInventoryPlace?: (placeId: string) => void;
}

export default function HelpSurvey({ onCheckStatus, onViewInventoryPlace }: HelpSurveyProps) {
  const { survey, t } = useSurvey();
  const [step, setStep] = useState<Step>('choose');
  const [needId, setNeedId] = useState<NeedId | null>(null);
  const [choice, setChoice] = useState<HelpOption | null>(null);
  const [note, setNote] = useState('');
  const [optionsState, setOptionsState] = useState<OptionsState>({ kind: 'idle' });
  const [deviceOrigin, setDeviceOrigin] = useState<Origin | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [triage, setTriage] = useState<Sampled<TriageResult> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<'preview' | 'submit' | null>(null);
  const [accepted, setAccepted] = useState<Sampled<SurveyAccepted> | null>(null);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noteCounterId = useId();
  const need = NEEDS.find((n) => n.id === needId);
  const district = DISTRICTS.find((item) => item.id === survey.district);
  const origin = useMemo(() => {
    if (deviceOrigin) return deviceOrigin;
    if (!district?.center) return DEFAULT_ORIGIN;
    const [latitude, longitude] = district.center;
    return { latitude, longitude, label: district.name };
  }, [deviceOrigin, district]);

  const request: SurveyRequest | null = useMemo(() => {
    if (!needId) return null;
    // The server reads any free text with its own classifier, which overrides the chosen need. So a request
    // for a specific place carries the place in `selected_options` only; free text is for the describe path.
    return {
      selected_options: choice ? [needId, requestedLabel(choice)] : [needId],
      free_text: choice ? null : note.trim() || null,
      district: district?.name ?? (choice?.kind !== 'hotline' ? choice?.district : null) ?? null,
      language: survey.language,
    };
  }, [needId, choice, note, survey.language, district]);

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
      .catch(() => !cancelled && setError('preview'));
    return () => {
      cancelled = true;
    };
    // Only re-run when the resident reaches the review step, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const ranked = useMemo(() => (optionsState.kind === 'ready' ? rankOptions(optionsState.options, origin) : []), [optionsState, origin]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Used only to sort the list on this device. It is never sent to the server.
        setDeviceOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: 'your location' });
        setLocating(false);
      },
      () => {
        setLocationError(true);
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
      if (choice && !result.sample) {
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
      setError('submit');
    } finally {
      setSending(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt(t('status.code'), code); // browsers without clipboard access
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

  const needLabel = need ? t(need.label) : '';

  return (
    <section className="help-survey" lang={survey.language === 'es' ? 'es' : 'en'} aria-labelledby="survey-heading">
      {step === 'choose' && (
        <div className="help-survey-language">
          <LanguageSelector />
          {survey.language === 'hmn' && <p>{t('lang.hmn.fallback')}</p>}
        </div>
      )}
      <div className="help-survey-heading">
        <h2 id="survey-heading">{t('intake.title')}</h2>
        <PrivacyBadge />
      </div>
      <p>{t('intake.demo')}</p>

      {step === 'sent' && accepted && (
        <section className="help-survey-review" aria-labelledby="survey-step-title">
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            {t('intake.sent')}
          </h3>
          <p>
            {t('status.code')} <strong className="help-survey-code">{accepted.token}</strong>
          </p>
          <button className="btn sm help-survey-copy" type="button" onClick={() => void copyCode(accepted.token)}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {t(copied ? 'status.copied' : 'status.copy')}
          </button>
          <span className="help-survey-sr" role="status">
            {copied ? t('status.copied') : ''}
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
            <p>{t('intake.placeFollowup')}</p>
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
              {t('intake.viewInventory')}
            </button>
          )}
          {accepted.sample && <p className="help-survey-note">{t('intake.sampleRequest')}</p>}
          <button className="help-survey-action" type="button" onClick={() => onCheckStatus(accepted.token)}>
            Check request status
          </button>{' '}
          <button className="help-survey-action secondary" type="button" onClick={startOver}>
            {t('status.new')}
          </button>
        </section>
      )}

      {step === 'review' && need && (
        <section aria-labelledby="survey-step-title">
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            {t('intake.review')}
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
          <TriageReviewCard
            triage={triage}
            sending={sending}
            error={error && t(error === 'preview' ? 'intake.previewError' : 'intake.sendError')}
            onConfirm={() => void send()}
            onEdit={back}
          />
        </section>
      )}

      {step === 'pick' && needId && needId !== 'other' && (
        <section aria-labelledby="survey-step-title" aria-busy={optionsState.kind !== 'ready'}>
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            {t(`intake.pick.${needId}.title`)}
          </h3>
          <p className="help-survey-sub">{t(`intake.pick.${needId}.help`)}</p>
          <div className="help-survey-tools">
            <button type="button" className="btn sm" onClick={useMyLocation} disabled={locating}>
              <LocateFixed size={16} aria-hidden="true" /> {t(locating ? 'district.locating' : 'intake.sortDistance')}
            </button>
            <span className="help-option-meta">
              {t('intake.distanceFrom', { origin: deviceOrigin ? t('intake.myLocation') : district?.center ? district.name : t('intake.downtown') })}
            </span>
          </div>
          {locationError && (
            <p className="help-survey-error" role="alert">
              {t('intake.locationFallback')}
            </p>
          )}

          {optionsState.kind !== 'ready' ? (
            <p role="status">{t('intake.findingPlaces')}</p>
          ) : (
            <>
              {optionsState.sample && <p className="help-survey-note">{t('intake.samplePlaces')}</p>}
              {ranked.length === 0 ? (
                <p role="status">{t('intake.noPlaces')}</p>
              ) : (
                <ul className="help-options">
                  {ranked.map(({ option, miles }) => (
                    <li key={option.id} className="help-option">
                      <div className="help-option-main">
                        <h4>{option.name}</h4>
                        <div className="help-option-tags">
                          {option.verified === false ? (
                            <span className="tag plain" style={{ fontStyle: 'italic', background: '#fef3c7', color: '#b45309' }}>
                              {t('intake.sampleListing')}
                            </span>
                          ) : (
                            <span className="tag plain" style={{ background: '#d1fae5', color: '#047857' }}>
                              {t('intake.verifiedListing')}
                            </span>
                          )}
                          {option.openNow !== undefined && (
                            <span className={`tag ${option.openNow ? 'ai' : 'plain'}`}>{t(option.openNow ? 'intake.open' : 'intake.closed')}</span>
                          )}
                          {miles !== null && <span className="tag plain">{miles < 0.1 ? t('intake.underDistance') : `${miles.toFixed(1)} mi`}</span>}
                          {option.noIdRequired && <span className="tag plain">{t('intake.noId')}</span>}
                          {option.staffed && option.kind !== 'pantry' && <span className="tag plain">{t('intake.staffed')}</span>}
                        </div>
                        <p className="help-option-meta">{option.address}</p>
                        <p className="help-option-meta">{option.hours}</p>
                      </div>
                      <div className="help-option-actions">
                        <button type="button" className="btn primary sm" onClick={() => pickOption(option)} aria-label={t('intake.requestPlace', { place: option.name })}>
                          {t('intake.requestThis')}
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
            {t('intake.describeInstead')}
          </button>{' '}
          <button className="help-survey-action secondary" type="button" onClick={back}>
            {t('intake.back')}
          </button>
        </section>
      )}

      {step === 'describe' && needId && (
        <form
          aria-labelledby="survey-step-title"
          onSubmit={(event) => {
            event.preventDefault();
            if (freeTextProblem(note, true)) return;
            setChoice(null);
            setError(null);
            setStep('review');
          }}
        >
          <h3 id="survey-step-title" tabIndex={-1} ref={headingRef}>
            {t('other.label')}
          </h3>
          <label className="help-survey-description">
            {t('intake.note', { need: needLabel })}
            <textarea
              rows={3}
              maxLength={FREE_TEXT_MAX}
              required
              value={note}
              placeholder={t('other.placeholder')}
              aria-describedby={noteCounterId}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <p id={noteCounterId} className="counter help-survey-counter" aria-live="polite">
            {t('other.count', { n: note.length, max: FREE_TEXT_MAX })}
          </p>
          <button className="help-survey-action" type="submit" disabled={freeTextProblem(note, true) !== null}>
            {t('intake.next')}
          </button>{' '}
          <button className="help-survey-action secondary" type="button" onClick={() => setStep(needId === 'other' ? 'choose' : 'pick')}>
            {t('intake.back')}
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
            <legend>{t('intake.choose')}</legend>
            <div className="help-survey-choices">
              {NEEDS.map(({ id, label, icon: Icon }) => (
                <label key={id} className="help-survey-choice">
                  <Icon size={22} aria-hidden="true" />
                  <span>{t(label)}</span>
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
          <details className="help-survey-district">
            <summary>{district?.name ?? t('intake.chooseDistrict')}</summary>
            <p>{t('district.help')}</p>
            <DistrictPicker />
          </details>
          <button className="help-survey-action" type="submit" disabled={!needId}>
            {t('intake.next')}
          </button>
        </form>
      )}
    </section>
  );
}

/** Directions and call links for one place. Both open outside the app. */
function PlaceLinks({ option }: { option: HelpOption }) {
  const { t } = useSurvey();
  const hasMap = option.latitude !== null && option.longitude !== null;
  return (
    <>
      {hasMap && (
        <a className="btn sm" href={directionsHref({ latitude: option.latitude as number, longitude: option.longitude as number })} target="_blank" rel="noreferrer">
          {t('intake.directions')}
        </a>
      )}
      {option.phone && (
        <a className="btn sm" href={telHref(option.phone)}>
          {t('intake.call', { phone: option.phone })}
        </a>
      )}
    </>
  );
}
