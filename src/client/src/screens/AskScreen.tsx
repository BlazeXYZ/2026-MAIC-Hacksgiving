import { useEffect, useRef, useState } from 'react';
import type { SurveyAccepted, TriageResult } from '../contracts';
import { previewTriage, submitSurvey, type Sampled } from '../api/intake';
import { Icon } from '../components/Icon';
import { PhoneHead } from '../components/shell/Frame';
import { EmergencyBar } from '../components/shell/EmergencyBar';
import { ChatInput } from '../components/survey/ChatInput';
import { TriageReviewCard, type FixTarget } from '../components/survey/TriageReviewCard';
import { PrivacyBadge } from '../components/privacy/PrivacyNotice';
import HelpSurvey from '../components/HelpSurvey';
import { toSurveyRequest, useSurvey } from '../state/survey';

/** need: pick a need · text: say more (or skip) · review: check what we understood · sent: done */
type Phase = 'need' | 'text' | 'review' | 'sent';

/**
 * Mockup screen 5 · Ask for help, as a chat. The resident picks a need (#2 cards), can add words in
 * the input bar (#5), then checks the AI's reading in a reply bubble (#6) before anything is sent.
 * Privacy (#16) is on by default, and the emergency line (#7) stays pinned above the input bar.
 */
export function AskScreen({ onBack, onFollow, onMap }: { onBack: () => void; onFollow: (token: string) => void; onMap: () => void }) {
  const { survey, update, t } = useSurvey();
  const [phase, setPhase] = useState<Phase>(survey.need ? 'text' : 'need');
  const [said, setSaid] = useState<string | null>(null);
  const [triage, setTriage] = useState<Sampled<TriageResult> | null>(null);
  const [fixing, setFixing] = useState<FixTarget>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Sampled<SurveyAccepted> | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [inputStartsEmpty, setInputStartsEmpty] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // Two quick taps on "Looks right" / "Have a neighbor bring it" land before React re-renders the disabled
  // state, so guard with a ref to never send the same request twice.
  const submitting = useRef(false);
  // Once a request is sent, leaving this screen clears it, so the next "+" starts a fresh request
  // instead of reopening the old need and text. Language, area and hubs are kept.
  const sentRef = useRef(false);
  useEffect(() => () => {
    if (sentRef.current) update({ need: null, freeText: '' });
  }, [update]);

  // Ask the triage layer again whenever the inputs it reads change during review.
  useEffect(() => {
    if (phase !== 'review') return;
    let live = true;
    setTriage(null);
    setError(null);
    previewTriage(toSurveyRequest(survey))
      .then((r) => live && setTriage(r))
      .catch(() => live && setError(t('review.failed')));
    return () => {
      live = false;
    };
  }, [phase, survey.need, survey.district]);

  // Keep the newest bubble in view.
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [phase, triage, fixing, said, accepted]);

  function pickNeed() {
    if (phase === 'need') setPhase('text');
  }

  function send(text: string) {
    if (!survey.need) update({ need: 'other' });
    setSaid(text);
    setInputStartsEmpty(true);
    setInputKey((k) => k + 1);
    setPhase('review');
  }

  function skip() {
    update({ freeText: '' });
    setSaid(null);
    setPhase('review');
  }

  function edit() {
    setFixing(null);
    setInputStartsEmpty(false);
    setInputKey((k) => k + 1);
    setPhase('text');
  }

  async function confirm() {
    if (!triage || submitting.current) return;
    submitting.current = true;
    setSending(true);
    setError(null);
    try {
      setAccepted(await submitSurvey(toSurveyRequest(survey), triage));
      sentRef.current = true;
      setPhase('sent');
    } catch {
      setError(t('review.failed'));
      submitting.current = false;
    } finally {
      setSending(false);
    }
  }

  const needOpen = survey.need === 'other' && phase === 'text';

  return (
    <div className="view">
      <PhoneHead meta={t('ask.kicker')} title={t('ask.title')} onBack={onBack} />

      <div className="view-body" ref={body}>
        <div className="ph-pad" style={{ marginBottom: 16 }}>
          <div className="tip">
            <Icon name="lamp" />
            <span>{t('ask.tip')}</span>
          </div>
        </div>

        <div className="chat" aria-live="polite">
          {/* The need tiles only until one is picked; after that the chat starts from the person's choice,
              like the mockup's starts from their message. The need can still be changed from the review tags. */}
          {phase === 'need' && (
            <div className="bubble hub">
              <span className="meta">{t('chat.ask')}</span>
              <HelpSurvey compact onPick={pickNeed} />
            </div>
          )}

          {survey.need && phase !== 'need' && <div className="bubble me">{t(`need.${survey.need}`)}</div>}

          {survey.need && phase !== 'need' && (
            <div className="bubble hub">
              {survey.need === 'other' ? t('chat.other') : t('chat.more')}
              {phase === 'text' && survey.need !== 'other' && (
                <div className="chips" style={{ marginTop: 10 }}>
                  <button type="button" className="chip" onClick={skip}>
                    {t('chat.skip')}
                    <Icon name="arrow" />
                  </button>
                </div>
              )}
            </div>
          )}

          {said && (phase === 'review' || phase === 'sent') && <div className="bubble me">{said}</div>}

          {(phase === 'review' || phase === 'sent') && (
            <TriageReviewCard
              triage={triage}
              settled={phase === 'sent'}
              sending={sending}
              error={error}
              fixing={fixing}
              onFix={setFixing}
              onConfirm={() => void confirm()}
              onEdit={edit}
            />
          )}

          {phase === 'review' && triage && !fixing && (
            <div className="bubble hub">
              <span className="meta">{t('close.title')}</span>
              <div className="match">
                <button type="button" onClick={onMap}>
                  <Icon name="pin" />
                  <span>
                    <b>{t('close.map')}</b>
                    <small>{t('close.map.d')}</small>
                  </span>
                  <Icon name="chev" />
                </button>
                <button type="button" onClick={() => void confirm()} disabled={sending}>
                  <Icon name="hand" />
                  <span>
                    <b>{t('close.neighbor')}</b>
                    <small>{t('close.neighbor.d')}</small>
                  </span>
                  <Icon name="chev" />
                </button>
              </div>
            </div>
          )}

          {phase === 'sent' && accepted && (
            <div className="bubble hub">
              <span className="meta">{t('sent.title')}</span>
              <div className="match">
                <button type="button" onClick={() => onFollow(accepted.token)}>
                  <Icon name="clock" />
                  <span>
                    <b>{t('sent.follow')}</b>
                    <small>{t('sent.follow.d', { code: accepted.token })}</small>
                  </span>
                  <Icon name="chev" />
                </button>
                <a href="tel:4143950552">
                  <Icon name="phone" />
                  <span>
                    <b>{accepted.service.name}</b>
                    <small>{accepted.service.next_step}</small>
                  </span>
                  <Icon name="chev" />
                </a>
              </div>
            </div>
          )}

          <div className="setrow">
            <span>
              <b id="keep-private">{t('private.title')}</b>
              <small>{t('private.help')}</small>
              <span style={{ display: 'block', marginTop: 8 }}>
                <PrivacyBadge long />
              </span>
            </span>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={survey.keepPrivate}
              aria-labelledby="keep-private"
              disabled={phase === 'sent'}
              onClick={() => update({ keepPrivate: !survey.keepPrivate })}
            />
          </div>
        </div>
      </div>

      <div className="view-foot">
        <EmergencyBar />
        <ChatInput key={inputKey} open={needOpen} startEmpty={inputStartsEmpty} disabled={phase === 'review' || phase === 'sent'} onSend={send} />
      </div>
    </div>
  );
}
