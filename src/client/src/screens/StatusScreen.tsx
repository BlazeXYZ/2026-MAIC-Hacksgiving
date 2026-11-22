import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Copy } from 'lucide-react';
import { getTicket, normalizeToken, type TicketLookup } from '../api/intake';
import { PrivacyBadge } from '../components/privacy/PrivacyNotice';
import { StatusTimeline } from '../components/status/StatusTimeline';
import { COMFORCE_HOTLINE } from '../components/shell/EmergencyBar';
import { useSurvey } from '../state/survey';
import '../components/survey/survey.css';

const POLL_MS = 15_000;

type Lookup = { code: string };
type Result = TicketLookup | { kind: 'error' };

interface Props {
  initialCode: string | null;
  onNewRequest: () => void;
}

/**
 * Anonymous status page (#15). Looks a request up by its code, no login. Shows the timeline, a rough
 * time estimate and the volunteer's alias, never anyone's phone number or address.
 */
export function StatusScreen({ initialCode, onNewRequest }: Props) {
  const { survey, t } = useSurvey();
  const [lookup, setLookup] = useState<Lookup | null>(initialCode ? { code: initialCode } : null);
  const [response, setResponse] = useState<{ lookup: Lookup; result: Result }>();
  const [draft, setDraft] = useState(initialCode ?? '');
  const [copied, setCopied] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const result = response?.lookup === lookup ? response.result : undefined;
  const draftCode = normalizeToken(draft);
  const canCheck = Boolean(draftCode && (draftCode !== lookup?.code || result));

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!lookup) return;
    const requested = lookup;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function refresh(inBackground = false) {
      let next: Result;
      try {
        next = await getTicket(requested.code);
      } catch {
        if (cancelled) return;
        if (inBackground) {
          timer = setTimeout(() => void refresh(true), POLL_MS);
          return;
        }
        next = { kind: 'error' };
      }
      if (cancelled) return;

      setResponse({ lookup: requested, result: next });
      if (next.kind === 'found' && next.ticket.status !== 'resolved') {
        timer = setTimeout(() => void refresh(true), POLL_MS);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lookup]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canCheck) return;
    setCopied(false);
    setLookup({ code: draftCode });
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt(t('status.code'), code); // fallback for browsers without clipboard access
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lookupForm = (
    <form className="card card-pad stack" onSubmit={submit}>
      <div className="lookup">
        <div className="field">
          <label htmlFor="token-input">{t('status.lookup')}</label>
          <input id="token-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="cf-XXXXXX" autoComplete="off" spellCheck={false} />
        </div>
        <button type="submit" className="btn primary" disabled={!canCheck}>
          {t('status.lookup.go')}
        </button>
      </div>
      {result?.kind === 'not-found' && (
        <p className="field-error" role="alert">
          {t('status.notfound')}
        </p>
      )}
      {result?.kind === 'error' && (
        <p className="field-error" role="alert">
          {t('status.failed')}
        </p>
      )}
    </form>
  );

  const ticket = result?.kind === 'found' ? result.ticket : null;
  const name = ticket?.assigned_volunteer_alias ?? t('status.someone');

  return (
    <section className="request-status stack" lang={survey.language === 'es' ? 'es' : 'en'} aria-labelledby="request-status-title">
      <header className="request-status-header">
        <div>
          <p className="meta">{t('status.kicker')}</p>
          <h1 id="request-status-title" className="title" ref={titleRef} tabIndex={-1}>{t('status.title')}</h1>
        </div>
        <PrivacyBadge />
      </header>

      {lookupForm}

      {lookup && !result && <p className="meta" role="status">{t('status.loading')}</p>}

      {ticket && (
        <>
          <section className="statuscard" aria-live="polite">
            <span className="meta">
              {t(`category.${ticket.category}`)} · {t(`urgency.${ticket.urgency}`)}
              {ticket.sample ? ` · ${t('sample')}` : ''}
            </span>
            <h2>{t(`status.head.${ticket.status}`, { name })}</h2>
            {ticket.status !== 'resolved' && (
              <div className="eta">
                <span className="live" aria-hidden="true" />
                {t(`status.eta.${ticket.urgency}`)}
              </div>
            )}
          </section>

          <div className="card token">
            <span className="meta" style={{ flexBasis: '100%' }}>
              {t('status.code')}
            </span>
            <code>{ticket.token}</code>
            <button type="button" className="btn sm" onClick={() => void copy(ticket.token)}>
              <Copy aria-hidden="true" />
              <span aria-live="polite">{copied ? t('status.copied') : t('status.copy')}</span>
            </button>
            <p className="meta">{t('status.code.help')}</p>
          </div>

          <div className="card">
            <StatusTimeline status={ticket.status} events={ticket.timeline} />
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <a className="btn ghost block" href={COMFORCE_HOTLINE.tel}>
              {t('status.wrong')}
            </a>
            <button type="button" className="btn block" onClick={onNewRequest}>
              {t('status.new')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
