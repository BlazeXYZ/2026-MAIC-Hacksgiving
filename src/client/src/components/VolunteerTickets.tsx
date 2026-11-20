import { Fragment, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useSurvey } from '../state/survey';
import type { StringKey } from '../i18n/strings';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'claimed';
}

type ClaimAction = 'claim' | 'unclaim';

const URGENCY_KEYS = { urgent: 'urgency.urgent', today: 'urgency.today', 'this-week': 'urgency.this_week' } as const satisfies Record<string, StringKey>;
type Urgency = keyof typeof URGENCY_KEYS;

const CATEGORY_KEYS = { Food: 'tkcat.food', Ride: 'tkcat.ride', 'Safe Haven': 'tkcat.haven', Supplies: 'tkcat.supplies' } as const satisfies Record<string, StringKey>;

/** Translations for the server's three sample tickets, by id. Unknown tickets show the server's text. */
const SAMPLE_TICKET_TEXT: Record<number, [StringKey, StringKey] | undefined> = {
  104: ['tkx.104.t', 'tkx.104.d'],
  105: ['tkx.105.t', 'tkx.105.d'],
  106: ['tkx.106.t', 'tkx.106.d'],
};

interface TicketDetails {
  category: 'Food' | 'Ride' | 'Safe Haven' | 'Supplies';
  district: string;
  urgency: Urgency;
}

// Temporary labels for the existing sample tickets until the feed supplies this metadata.
const SAMPLE_TICKET_DETAILS: Record<number, TicketDetails | undefined> = {
  104: { category: 'Food', district: 'Juneautown', urgency: 'urgent' },
  105: { category: 'Supplies', district: 'Historic Third Ward', urgency: 'this-week' },
  106: { category: 'Food', district: 'Near West Side', urgency: 'today' },
};

const DISTRICTS = Object.values(SAMPLE_TICKET_DETAILS)
  .flatMap((details) => details ? [details.district] : [])
  .sort();

/**
 * Keys for the tickets this browser has taken, shared by every copy of the board (the Home preview and the
 * Requests tab), so "Hand it back" still shows after moving between them. Kept in memory for the session only.
 */
const claimKeyStore = new Map<number, string>();

/**
 * Volunteer ticket board (#17) with claim and undo, drawn as the mockup's request tickets (frame 10).
 * `preview` shows the top N tickets without filters (used on Home).
 */
export default function VolunteerTickets({ preview, onOpenCount }: { preview?: number; onOpenCount?: (n: number) => void } = {}) {
  const { t } = useSurvey();
  const titleOf = (ticket: Ticket) => (SAMPLE_TICKET_TEXT[ticket.id] ? t(SAMPLE_TICKET_TEXT[ticket.id]![0]) : ticket.title);
  const descriptionOf = (ticket: Ticket) => (SAMPLE_TICKET_TEXT[ticket.id] ? t(SAMPLE_TICKET_TEXT[ticket.id]![1]) : ticket.description);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const claimKeys = useRef(claimKeyStore);
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [urgency, setUrgency] = useState('');
  const [district, setDistrict] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadTickets() {
      try {
        const response = await fetch('/api/tickets', { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Ticket list request failed');
        }
        const listedTickets: Ticket[] = await response.json();
        if (!controller.signal.aborted) {
          setTickets(listedTickets);
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(true);
        }
      }
    }

    void loadTickets();
    return () => controller.abort();
  }, [loadAttempt]);

  async function changeClaim(ticket: Ticket, action: ClaimAction) {
    if (pendingId !== null) return;
    const undoing = action === 'unclaim';
    let key = claimKeys.current.get(ticket.id);
    if (!key) {
      if (undoing) return;
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      claimKeys.current.set(ticket.id, key);
    }

    setPendingId(ticket.id);
    setFeedback('');

    try {
      const response = await fetch(`/api/tickets/${ticket.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (response.status === 409 || response.status === 403) {
        claimKeys.current.delete(ticket.id);
        setTickets((current) => current?.map((item) => (
          item.id === ticket.id ? { ...item, status: 'claimed' } : item
        )) ?? null);
        setFeedback(t('tk.taken', { title: titleOf(ticket) }));
        return;
      }

      if (response.status === 404) {
        claimKeys.current.delete(ticket.id);
        setTickets((current) => current?.filter((item) => item.id !== ticket.id) ?? null);
        setFeedback(t('tk.gone', { title: titleOf(ticket) }));
        return;
      }

      if (!response.ok) {
        throw new Error('Ticket update failed');
      }

      const updatedTicket: Ticket = await response.json();
      if (undoing) claimKeys.current.delete(ticket.id);
      setTickets((current) => current?.map((item) => (
        item.id === updatedTicket.id ? updatedTicket : item
      )) ?? null);
      setFeedback(t(undoing ? 'tk.reopened' : 'tk.youclaimed', { title: titleOf(ticket) }));
    } catch {
      setFeedback(t(undoing ? 'tk.undofail' : 'tk.claimfail'));
    } finally {
      setPendingId(null);
    }
  }

  let statusMessage = feedback;
  if (loadError) {
    statusMessage = t('tk.loadfail');
  } else if (tickets === null) {
    statusMessage = t('tk.loading');
  } else if (tickets.length === 0 && !feedback) {
    statusMessage = t('tk.empty');
  }

  const searchTerm = query.trim().toLowerCase();
  const filteredTickets = tickets?.filter((ticket) => {
    const details = SAMPLE_TICKET_DETAILS[ticket.id];
    const matchesUrgency = !urgency || details?.urgency === urgency;
    const matchesDistrict = !district || details?.district === district;
    const text = [titleOf(ticket), descriptionOf(ticket), ticket.title, details && t(CATEGORY_KEYS[details.category]), details?.district].join(' ').toLowerCase();
    return matchesUrgency && matchesDistrict && text.includes(searchTerm);
  });

  const rank: Record<Urgency, number> = { urgent: 0, today: 1, 'this-week': 2 };
  const sortedTickets = filteredTickets
    ?.slice()
    .sort((a, b) => rank[SAMPLE_TICKET_DETAILS[a.id]?.urgency ?? 'this-week'] - rank[SAMPLE_TICKET_DETAILS[b.id]?.urgency ?? 'this-week'])
    .slice(0, preview ?? undefined);
  const openCount = tickets?.filter((ticket) => ticket.status === 'open').length ?? 0;
  useEffect(() => {
    if (tickets) onOpenCount?.(openCount);
  }, [tickets, openCount, onOpenCount]);


  // The locked training card (mockup frame 10) sits in urgency order: it's a "Today" request, so it goes after
  // the urgent tickets. Hidden in the Home preview and whenever a filter or search would exclude it.
  const showLocked = !preview && !!tickets?.length && (!urgency || urgency === 'today') && !district && !query.trim();
  const lockedCard = (
    <li className="req locked">
      <div className="req-main">
        <div className="req-meta">
          <span className="tag today">{t('urgency.today')}</span>
          <span className="meta">{t('lock.cat')}</span>
        </div>
        <h3>{t('lock.title')}</h3>
        <div className="lockline">
          <span className="where">
            <Icon name="lock" />
            {t('lock.why')}
          </span>
          <button type="button" className="btn" aria-disabled="true" title={t('notbuilt')}>
            {t('lock.btn')}
          </button>
        </div>
      </div>
      <span className="lockstub">
        <Icon name="lock" />
        {t('lock.stub')}
      </span>
    </li>
  );
  function withLocked(items: JSX.Element[] | undefined) {
    if (!items || !showLocked) return items;
    const at = (sortedTickets ?? []).filter((tk) => SAMPLE_TICKET_DETAILS[tk.id]?.urgency === 'urgent').length;
    return [...items.slice(0, at), <Fragment key="locked">{lockedCard}</Fragment>, ...items.slice(at)];
  }

  function chip(label: string, pressed: boolean, onClick: () => void) {
    return (
      <button key={label} type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
        {pressed && <Icon name="check" />}
        {label}
      </button>
    );
  }

  return (
    <section aria-label={t('tk.label')} className="volunteer-tickets">
      {!preview && (
        <>
          <p className="meta" style={{ margin: '0 20px 12px' }}>
            {t('tk.intro')}
          </p>
          {tickets && tickets.length > 0 && (
            <>
              <label className="searchbox">
                <Icon name="search" />
                <span className="visually-hidden">{t('tk.search')}</span>
                <input type="search" placeholder={t('tk.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <div className="filters" role="group" aria-label={t('tk.filters')}>
                {chip(t('tk.all'), !urgency && !district, () => {
                  setUrgency('');
                  setDistrict('');
                })}
                {(Object.keys(URGENCY_KEYS) as Urgency[]).map((value) => chip(t(URGENCY_KEYS[value]), urgency === value, () => setUrgency(urgency === value ? '' : value)))}
                <span className="sep" aria-hidden="true" />
                {DISTRICTS.map((name) => chip(name, district === name, () => setDistrict(district === name ? '' : name)))}
              </div>
              <div className="ph-pad" style={{ marginTop: 12 }}>
                <p className="why" style={{ fontSize: 14 }}>
                  <Icon name="spark" />
                  {t('req.sorted')}
                </p>
              </div>
            </>
          )}
        </>
      )}

      <p role="status" className="feedline" style={preview ? { margin: '0 0 12px' } : { marginTop: 16 }}>
        {statusMessage}
      </p>
      {loadError && (
        <div className={preview ? undefined : 'ph-pad'}>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              setLoadError(false);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            {t('tk.retry')}
          </button>
        </div>
      )}
      {tickets && tickets.length > 0 && sortedTickets?.length === 0 && (
        <p className="meta" style={{ margin: '0 20px' }} role="status">
          {t('tk.nomatch')}
        </p>
      )}

      <div className={preview ? undefined : 'ph-pad'} style={preview ? undefined : { marginTop: 4 }}>
      <ul className="tickets">
        {withLocked(sortedTickets?.map((ticket) => {
          const details = SAMPLE_TICKET_DETAILS[ticket.id];
          const taken = ticket.status === 'claimed';
          const mine = claimKeys.current.has(ticket.id);
          const busy = pendingId === ticket.id;
          return (
            <li key={ticket.id} className={taken ? 'req taken' : 'req'}>
              <div className="req-main">
                {details && (
                  <div className="req-meta">
                    <span className={`tag ${details.urgency === 'this-week' ? 'week' : details.urgency}`}>{t(URGENCY_KEYS[details.urgency])}</span>
                    <span className="meta">{t(CATEGORY_KEYS[details.category])}</span>
                  </div>
                )}
                <h3>{titleOf(ticket)}</h3>
                {details && (
                  <p className="where">
                    <Icon name="pin" />
                    {details.district}
                  </p>
                )}
                <p className="why">
                  <Icon name="spark" />
                  {descriptionOf(ticket)}
                </p>
                {taken && mine && (
                  <button
                    type="button"
                    className="handback"
                    aria-label={t('tk.undo.aria', { title: titleOf(ticket) })}
                    onClick={() => void changeClaim(ticket, 'unclaim')}
                    disabled={pendingId !== null}
                  >
                    {busy ? t('tk.undoing') : t('tk.undo')}
                    <Icon name="chev" />
                  </button>
                )}
              </div>
              <button
                className="take"
                type="button"
                aria-label={taken ? t('tk.claimed') : t(busy ? 'tk.claiming.aria' : 'tk.claim.aria', { title: titleOf(ticket) })}
                onClick={() => void changeClaim(ticket, 'claim')}
                disabled={taken || pendingId !== null}
              >
                <Icon name={taken ? 'check' : 'hand'} />
                <span>{taken ? t('tk.claimed') : busy ? t('tk.claiming') : t('tk.claim')}</span>
                <small>#{ticket.id}</small>
              </button>
            </li>
          );
        }))}

      </ul>
      </div>
    </section>
  );
}
