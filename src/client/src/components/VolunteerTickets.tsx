import { useEffect, useRef, useState } from 'react';
import './VolunteerTickets.css';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'claimed';
}

type ClaimAction = 'claim' | 'unclaim';

const URGENCY_LABELS = { urgent: 'Urgent', today: 'Today', 'this-week': 'This week' } as const;
type Urgency = keyof typeof URGENCY_LABELS;

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

export default function VolunteerTickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const claimKeys = useRef(new Map<number, string>());
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
        setFeedback(`${ticket.title} has already been claimed.`);
        return;
      }

      if (response.status === 404) {
        claimKeys.current.delete(ticket.id);
        setTickets((current) => current?.filter((item) => item.id !== ticket.id) ?? null);
        setFeedback(`${ticket.title} is no longer available.`);
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
      setFeedback(undoing ? `${ticket.title} is open again.` : `You claimed ${ticket.title}.`);
    } catch {
      setFeedback(undoing ? 'Could not undo this claim. Try again.' : 'Could not claim this ticket. Try again.');
    } finally {
      setPendingId(null);
    }
  }

  let statusMessage = feedback;
  if (loadError) {
    statusMessage = 'Could not load volunteer tickets.';
  } else if (tickets === null) {
    statusMessage = 'Loading volunteer tickets…';
  } else if (tickets.length === 0 && !feedback) {
    statusMessage = 'There are no sample tickets to show.';
  }

  const searchTerm = query.trim().toLowerCase();
  const filteredTickets = tickets?.filter((ticket) => {
    const details = SAMPLE_TICKET_DETAILS[ticket.id];
    const matchesUrgency = !urgency || details?.urgency === urgency;
    const matchesDistrict = !district || details?.district === district;
    const text = [ticket.title, ticket.description, details?.category, details?.district].join(' ').toLowerCase();
    return matchesUrgency && matchesDistrict && text.includes(searchTerm);
  });

  return (
    <section aria-labelledby="volunteer-tickets-heading" style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <h3 id="volunteer-tickets-heading" style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Volunteer Support Tickets</h3>
      <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.75rem' }}>
        Sample tasks for Food Pantry &amp; Mutual Aid.
      </p>
      <div role="status" style={{ fontSize: '0.85rem', color: '#334155', marginBottom: statusMessage ? '0.75rem' : 0 }}>
        {statusMessage}
      </div>
      {loadError && (
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Retry loading tickets
        </button>
      )}
      {tickets && tickets.length > 0 && (
        <div className="volunteer-ticket-filters" role="group" aria-label="Filter volunteer tickets">
          <label>
            Search tickets
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            Urgency
            <select value={urgency} onChange={(event) => setUrgency(event.target.value)}>
              <option value="">All urgency levels</option>
              {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            District
            <select value={district} onChange={(event) => setDistrict(event.target.value)}>
              <option value="">All districts</option>
              {DISTRICTS.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
      )}
      {tickets && tickets.length > 0 && filteredTickets?.length === 0 && (
        <p className="volunteer-ticket-no-results" role="status">No tickets match your filters.</p>
      )}
      {filteredTickets && filteredTickets.length > 0 && (
        <ul style={{ display: 'grid', gap: '0.5rem', listStyle: 'none', margin: 0, padding: 0 }}>
          {filteredTickets.map((ticket) => {
            const details = SAMPLE_TICKET_DETAILS[ticket.id];
            return (
              <li key={ticket.id} className="volunteer-ticket-card">
                <strong>{ticket.title}</strong>
                {details && (
                  <div className="volunteer-ticket-tags">
                    <span data-urgency={details.urgency}>{URGENCY_LABELS[details.urgency]}</span>
                    <span>{details.category}</span>
                    <span>{details.district}</span>
                  </div>
                )}
                <p style={{ color: '#475569', margin: '0.25rem 0 0.5rem' }}>{ticket.description}</p>
                {ticket.status === 'claimed' ? (
                  <div className="volunteer-ticket-claimed">
                    <strong>Claimed</strong>
                    {claimKeys.current.has(ticket.id) && (
                      <button
                        type="button"
                        className="volunteer-ticket-undo"
                        aria-label={`Undo claim: ${ticket.title}`}
                        onClick={() => void changeClaim(ticket, 'unclaim')}
                        disabled={pendingId !== null}
                      >
                        {pendingId === ticket.id ? 'Undoing…' : 'Undo claim'}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={pendingId === ticket.id ? `Claiming ${ticket.title}` : `Claim Ticket: ${ticket.title}`}
                    onClick={() => void changeClaim(ticket, 'claim')}
                    disabled={pendingId !== null}
                    style={{
                      backgroundColor: pendingId === null ? '#1d4ed8' : '#475569',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '4px',
                      cursor: pendingId === null ? 'pointer' : 'default',
                      fontSize: '0.85rem',
                    }}
                  >
                    {pendingId === ticket.id ? 'Claiming…' : 'Claim Ticket'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
