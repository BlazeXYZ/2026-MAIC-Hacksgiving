import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PublicTicket } from '../contracts';
import { cancelTicket, getTicket, normalizeToken, type Sampled } from '../api/intake';
import { Icon } from '../components/Icon';
import { PhoneHead, TabBar, type Tab } from '../components/shell/Frame';
import { EmergencyBar, COMFORCE_HOTLINE } from '../components/shell/EmergencyBar';
import { PrivacyBadge } from '../components/privacy/PrivacyNotice';
import { StatusTimeline } from '../components/status/StatusTimeline';
import { useSurvey } from '../state/survey';
import { useQuickExit } from '../state/quickExit';
import { LanguageSelector } from '../components/survey/LanguageSelector';

const POLL_MS = 15_000;

type Load = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; ticket: Sampled<PublicTicket> } | { kind: 'not-found' } | { kind: 'error' };

/**
 * Mockup screen 6 · Help is on the way (#15). Anonymous: looked up by code, no login. Shows who is coming
 * (alias only), roughly when, and the timeline. Calls go through ComForce, never a personal number.
 */
export function StatusScreen({ token, onToken, onBack, onNav }: { token: string | null; onToken: (t: string) => void; onBack: () => void; onNav: (tab: Tab) => void }) {
  const { t } = useSurvey();
  const { shake, setShake } = useQuickExit();
  const [load, setLoad] = useState<Load>({ kind: token ? 'loading' : 'idle' });
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchTicket = useCallback(async (code: string, quiet: boolean) => {
    if (!quiet) setLoad({ kind: 'loading' });
    try {
      const res = await getTicket(code);
      setLoad(res.kind === 'found' ? { kind: 'found', ticket: res.ticket } : { kind: 'not-found' });
    } catch {
      if (!quiet) setLoad({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchTicket(token, false);
    const id = setInterval(() => void fetchTicket(token, true), POLL_MS);
    return () => clearInterval(id);
  }, [token, fetchTicket]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const code = normalizeToken(draft);
    if (code) onToken(code);
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt(t('status.code'), code); // fallback where clipboard access is blocked
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const ticket = load.kind === 'found' ? load.ticket : null;
  const alias = ticket?.assigned_volunteer_alias ?? null;
  const cancelled = ticket?.timeline.some((e) => e.label === 'Cancelled') ?? false;
  const showLookup = !token || load.kind === 'not-found' || load.kind === 'error';

  return (
    <div className="view">
      <PhoneHead meta={t('status.kicker')} title={ticket ? t(`status.t.${ticket.status}`) : t('status.lookup')} onBack={onBack} />

      <div className="view-body" style={{ paddingBottom: 24 }}>
        {showLookup && (
          <form className="ph-pad lookup" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label htmlFor="token-input">{t('status.code')}</label>
              <input id="token-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="cf-XXXXXX" autoComplete="off" spellCheck={false} />
            </div>
            {load.kind === 'not-found' && (
              <p className="field-error" role="alert">
                {t('status.notfound')}
              </p>
            )}
            {load.kind === 'error' && (
              <p className="field-error" role="alert">
                {t('review.failed')}
              </p>
            )}
            <button type="submit" className="btn primary block" disabled={!normalizeToken(draft)}>
              {t('status.lookup.go')}
            </button>
          </form>
        )}

        {load.kind === 'loading' && (
          <div className="ph-pad" role="status">
            <span className="visually-hidden">{t('review.loading')}</span>
            <div className="statuscard" style={{ display: 'grid', gap: 10 }}>
              <i className="skeleton" style={{ width: '40%', opacity: 0.5 }} />
              <i className="skeleton" style={{ height: 24, opacity: 0.5 }} />
            </div>
          </div>
        )}

        {ticket && (
          <>
            <div className="ph-pad">
              <div className="statuscard" aria-live="polite">
                <span className="meta">
                  {t(`category.${ticket.category}`)} · {t(`urgency.${ticket.urgency}`)}
                  {ticket.sample ? ` · ${t('sample')}` : ''}
                </span>
                <h2>{cancelled ? t('status.cancelled') : t(`status.head.${ticket.status}`, { name: alias ?? t('status.someone') })}</h2>
                {ticket.status !== 'resolved' && (
                  <div className="eta2">
                    <span className="live" />
                    {t(`status.eta.${ticket.urgency}`)}
                  </div>
                )}
              </div>
            </div>

            <div className="ph-pad" style={{ marginTop: 16 }}>
              <div className="card">
                <div className="vol">
                  <span className={alias ? 'avatar' : 'avatar wait'}>{alias ? alias[0] : <Icon name="clock" />}</span>
                  <span>
                    <b>{alias ?? t('status.vol.wait')}</b>
                    <small>{alias ? t('status.vol.d') : t('status.vol.wait.d')}</small>
                  </span>
                </div>
                {alias && (
                  <div className="vol-acts">
                    <a className="btn sm" href={COMFORCE_HOTLINE.tel}>
                      <Icon name="msg" />
                      {t('status.msg')}
                    </a>
                    <a className="btn sm" href={COMFORCE_HOTLINE.tel}>
                      <Icon name="phone" />
                      {t('status.call')}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="ph-pad" style={{ marginTop: 16 }}>
              <div className="card">
                <StatusTimeline status={ticket.status} events={ticket.timeline} />
              </div>
            </div>

            <div className="ph-pad" style={{ marginTop: 16 }}>
              <div className="card code">
                <span>
                  <span className="meta">{t('status.code')}</span>
                  <b>{ticket.token}</b>
                  <small>{t('status.code.help')}</small>
                </span>
                <button type="button" className="btn sm" onClick={() => void copy(ticket.token)}>
                  <span aria-live="polite">{copied ? t('status.copied') : t('status.copy')}</span>
                </button>
              </div>
            </div>

            <div className="ph-pad" style={{ marginTop: 16 }}>
              <div className="tip" style={{ alignItems: 'center' }}>
                <Icon name="lock" />
                <span style={{ flex: 1 }}>{t('status.masked')}</span>
                <PrivacyBadge />
              </div>
            </div>

            <div className="ph-pad" style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              {ticket.status !== 'resolved' && ticket.sample && (
                <button
                  type="button"
                  className="btn block"
                  onClick={() => {
                    if (cancelTicket(ticket.token)) void fetchTicket(ticket.token, true);
                  }}
                >
                  {t('status.cancel')}
                </button>
              )}
              <a className="btn ghost block" href={COMFORCE_HOTLINE.tel}>
                {t('status.wrong')}
              </a>
            </div>
          </>
        )}

        {/* Settings from the mockup's "Me" frame (15) that work today. The only place to change language
            or shake-to-exit after the first visit. */}
        <section className="ph-sec" aria-labelledby="me-settings">
          <div className="ph-h">
            <h2 id="me-settings">{t('me.settings')}</h2>
          </div>
          <div className="ph-pad">
            <div className="setlist">
              <div>
                <span>
                  <b id="me-shake">{t('lesson.shake')}</b>
                  <small>{t('lesson.shake.d')}</small>
                </span>
                <button type="button" className="switch" role="switch" aria-checked={shake} aria-labelledby="me-shake" onClick={() => void setShake(!shake)} />
              </div>
              <div>
                <span>
                  <b>{t('me.lang')}</b>
                </span>
                <LanguageSelector variant="seg" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="view-foot">
        <EmergencyBar />
        <TabBar current="me" onNav={onNav} />
      </div>
    </div>
  );
}
