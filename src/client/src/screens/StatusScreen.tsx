import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Lock } from 'lucide-react';
import type { PublicTicket } from '../contracts';
import { getTicket, normalizeToken, type Sampled } from '../api/intake';
import { PrivacyBadge } from '../components/privacy/PrivacyNotice';
import { StatusTimeline } from '../components/status/StatusTimeline';
import { COMFORCE_HOTLINE } from '../components/shell/EmergencyBar';
import { useSurvey } from '../state/survey';

const POLL_MS = 15_000;

type Load = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; ticket: Sampled<PublicTicket> } | { kind: 'not-found' } | { kind: 'error' };

/**
 * Anonymous status page (#15). Looks a request up by its code, no login. Shows the timeline, a rough
 * time estimate and the volunteer's alias, never anyone's phone number or address.
 */
export function StatusScreen({ token, onToken, onNewRequest }: { token: string | null; onToken: (t: string) => void; onNewRequest: () => void }) {
  const { t } = useSurvey();
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
        <button type="submit" className="btn primary" disabled={!normalizeToken(draft)}>
          {t('status.lookup.go')}
        </button>
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
    </form>
  );

  const ticket = load.kind === 'found' ? load.ticket : null;
  const name = ticket?.assigned_volunteer_alias ?? t('status.someone');

  return (
    <main className="page stack" style={{ paddingTop: 24 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p className="meta">{t('status.kicker')}</p>
          <h1 className="title">{t('status.title')}</h1>
        </div>
        <PrivacyBadge />
      </header>

      {!token || load.kind === 'not-found' || load.kind === 'error' ? lookupForm : null}

      {load.kind === 'loading' && (
        <div className="card card-pad review-skel" role="status">
          <span className="visually-hidden">{t('review.loading')}</span>
          <div className="skeleton" style={{ height: 28, width: '70%' }} />
          <div className="skeleton" style={{ width: '40%' }} />
        </div>
      )}

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

          <div className="tip">
            <Lock aria-hidden="true" />
            <span>{t('status.masked')}</span>
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
    </main>
  );
}
