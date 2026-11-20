import { useEffect, useState } from 'react';
import { Check, Hand, MapPin } from 'lucide-react';
import './VolunteerTickets.css';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'claimed';
}

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
  const [claimingId, setClaimingId] = useState<number | null>(null);
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

  async function claimTicket(ticket: Ticket) {
    setClaimingId(ticket.id);
    setFeedback('');

    try {
      const response = await fetch(`/api/tickets/${ticket.id}/claim`, { method: 'POST' });

      if (response.status === 409) {
        setTickets((current) => current?.map((item) => (
          item.id === ticket.id ? { ...item, status: 'claimed' } : item
        )) ?? null);
        setFeedback(`${ticket.title} has already been claimed.`);
        return;
      }

      if (response.status === 404) {
        setTickets((current) => current?.filter((item) => item.id !== ticket.id) ?? null);
        setFeedback(`${ticket.title} is no longer available.`);
        return;
      }

      if (!response.ok) {
        throw new Error('Claim request failed');
      }

      const claimedTicket: Ticket = await response.json();
      setTickets((current) => current?.map((item) => (
        item.id === claimedTicket.id ? claimedTicket : item
      )) ?? null);
      setFeedback(`You claimed ${ticket.title}.`);
    } catch {
      setFeedback('Could not claim this ticket. Try again.');
    } finally {
      setClaimingId(null);
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
    <section aria-labelledby="volunteer-tickets-heading" className="volunteer-tickets">
      <h2 id="volunteer-tickets-heading">Volunteer support tickets</h2>
      <p className="volunteer-ticket-intro">Sample tasks for Food Pantry &amp; Mutual Aid.</p>
      <div role="status" className="volunteer-ticket-status">
        {statusMessage}
      </div>
      {loadError && (
        <button
          type="button"
          className="hub-button hub-button--secondary"
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
        <ul className="volunteer-ticket-list">
          {filteredTickets.map((ticket) => {
            const details = SAMPLE_TICKET_DETAILS[ticket.id];
            return (
              <li key={ticket.id} className="volunteer-ticket-card">
                <div className="volunteer-ticket-content">
                  {details && (
                    <div className="volunteer-ticket-tags">
                      <span data-urgency={details.urgency}>{URGENCY_LABELS[details.urgency]}</span>
                      <span>{details.category}</span>
                    </div>
                  )}
                  <h3>{ticket.title}</h3>
                  <p>{ticket.description}</p>
                  {details && <p className="volunteer-ticket-district"><MapPin size={15} aria-hidden="true" /> {details.district}</p>}
                </div>
                {ticket.status === 'claimed' ? (
                  <span className="volunteer-ticket-stub is-claimed"><Check size={22} aria-hidden="true" /> Claimed</span>
                ) : (
                  <button
                    className="volunteer-ticket-stub"
                    type="button"
                    aria-label={claimingId === ticket.id ? `Claiming ${ticket.title}` : `Claim Ticket: ${ticket.title}`}
                    onClick={() => void claimTicket(ticket)}
                    disabled={claimingId !== null}
                  >
                    <Hand size={22} aria-hidden="true" />
                    {claimingId === ticket.id ? 'Claiming…' : 'Claim ticket'}
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
