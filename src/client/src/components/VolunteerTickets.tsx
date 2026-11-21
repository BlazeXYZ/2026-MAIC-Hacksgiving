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

const RELAY_PHONE = '414-395-0552';

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

  // Issue #18: Modal and claim confirmation state
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [confirmUnclaimId, setConfirmUnclaimId] = useState<number | null>(null);

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

    // Optimistic UI update: immediately reflect new state
    const previousStatus = ticket.status;
    const optimisticStatus: 'open' | 'claimed' = undoing ? 'open' : 'claimed';
    setTickets((current) => current?.map((item) => (
      item.id === ticket.id ? { ...item, status: optimisticStatus } : item
    )) ?? null);

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
      setFeedback(undoing ? `${ticket.title} is open again.` : `You claimed ${ticket.title}. Contact relay unlocked.`);
    } catch {
      // Revert optimistic update on failure
      setTickets((current) => current?.map((item) => (
        item.id === ticket.id ? { ...item, status: previousStatus } : item
      )) ?? null);
      setFeedback(undoing ? 'Could not undo this claim. Try again.' : 'Could not claim this ticket. Try again.');
    } finally {
      setPendingId(null);
      setConfirmUnclaimId(null);
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

  const selectedTicket = tickets?.find((t) => t.id === selectedTicketId) ?? null;
  const selectedDetails = selectedTicket ? SAMPLE_TICKET_DETAILS[selectedTicket.id] : undefined;

  return (
    <section aria-labelledby="volunteer-tickets-heading" className="volunteer-tickets-section">
      <div className="volunteer-tickets-head">
        <h3 id="volunteer-tickets-heading">Neighbors who need a hand</h3>
        {tickets && <span className="count">{tickets.length} nearby</span>}
      </div>
      <p className="volunteer-tickets-sub">
        Sample tasks for Food Pantry &amp; Mutual Aid. Open a ticket for full details and relay contact.
      </p>
      <div role="status" style={{ fontSize: '0.85rem', color: 'var(--ink-2)', marginBottom: statusMessage ? '0.75rem' : 0 }}>
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
            const isClaimedByMe = ticket.status === 'claimed' && claimKeys.current.has(ticket.id);
            return (
              <li key={ticket.id} className="volunteer-ticket-card">
                <div
                  className="volunteer-ticket-card-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTicketId(ticket.id); }}
                  aria-label={`Open details for ${ticket.title}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong>{ticket.title}</strong>
                    <span className="volunteer-ticket-view-link">View Details &rarr;</span>
                  </div>
                  {details && (
                    <div className="volunteer-ticket-tags">
                      <span data-urgency={details.urgency}>{URGENCY_LABELS[details.urgency]}</span>
                      <span>{details.category}</span>
                      <span>{details.district}</span>
                    </div>
                  )}
                  <p style={{ color: 'var(--ink-2)', margin: '0.25rem 0 0.5rem' }}>{ticket.description}</p>
                </div>

                <div className="volunteer-ticket-card-actions">
                  {ticket.status === 'claimed' ? (
                    <div className="volunteer-ticket-claimed">
                      <strong>✓ Claimed</strong>
                      {isClaimedByMe && (
                        <>
                          <a
                            className="volunteer-relay-btn"
                            href={`tel:${RELAY_PHONE.replace(/[^\d+]/g, '')}`}
                            aria-label={`Call Comforce relay for ${ticket.title}`}
                          >
                            📞 Comforce Relay
                          </a>
                          <button
                            type="button"
                            className="volunteer-ticket-undo"
                            aria-label={`Undo claim: ${ticket.title}`}
                            onClick={() => void changeClaim(ticket, 'unclaim')}
                            disabled={pendingId !== null}
                          >
                            {pendingId === ticket.id ? 'Undoing…' : 'Undo claim'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={pendingId === ticket.id ? `Claiming ${ticket.title}` : `Claim Ticket: ${ticket.title}`}
                      onClick={() => void changeClaim(ticket, 'claim')}
                      disabled={pendingId !== null}
                      className="volunteer-claim-btn"
                    >
                      {pendingId === ticket.id ? 'Claiming…' : 'Claim Request'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Ticket Detail Modal (Issue #18) */}
      {selectedTicket && (
        <div
          className="volunteer-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedTicketId(null)}
        >
          <div
            className="volunteer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="volunteer-modal-header">
              <h4 id="ticket-modal-title">{selectedTicket.title}</h4>
              <button
                type="button"
                className="volunteer-modal-close"
                onClick={() => setSelectedTicketId(null)}
                aria-label="Close ticket details"
              >
                &times;
              </button>
            </div>

            <div className="volunteer-modal-body">
              {selectedDetails && (
                <div className="volunteer-ticket-tags" style={{ marginBottom: '0.75rem' }}>
                  <span data-urgency={selectedDetails.urgency}>{URGENCY_LABELS[selectedDetails.urgency]}</span>
                  <span>Category: {selectedDetails.category}</span>
                  <span>Neighborhood: {selectedDetails.district}</span>
                </div>
              )}

              <div className="volunteer-modal-field">
                <strong>Request Description</strong>
                <p>{selectedTicket.description}</p>
              </div>

              <div className="volunteer-modal-field">
                <strong>Location &amp; Area</strong>
                <p>Approximate neighborhood: {selectedDetails?.district ?? 'Milwaukee Area'}. Strict PII privacy is preserved.</p>
              </div>

              <div className="volunteer-modal-field">
                <strong>Current Status</strong>
                <p>
                  Status: <span className={`volunteer-status-pill ${selectedTicket.status === 'claimed' ? 'volunteer-status-pill--claimed' : 'volunteer-status-pill--open'}`}>
                    {selectedTicket.status === 'claimed' ? 'Claimed by Volunteer' : 'Open for Help'}
                  </span>
                </p>
              </div>

              {selectedTicket.status === 'claimed' && (
                <div className="volunteer-relay-unlocked-box">
                  <div style={{ fontWeight: 600, color: 'var(--green-ink)', marginBottom: '0.25rem' }}>
                    🎉 Request Claimed &amp; Relay Unlocked
                  </div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--green-ink)' }}>
                    Resident privacy is protected. Contact the Comforce dispatch relay to coordinate delivery or support.
                  </p>
                  <a
                    className="volunteer-relay-action-btn"
                    href={`tel:${RELAY_PHONE.replace(/[^\d+]/g, '')}`}
                  >
                    📞 Call Comforce Relay ({RELAY_PHONE})
                  </a>
                </div>
              )}
            </div>

            <div className="volunteer-modal-footer">
              {selectedTicket.status === 'open' ? (
                <button
                  type="button"
                  className="volunteer-claim-btn"
                  disabled={pendingId !== null}
                  onClick={() => void changeClaim(selectedTicket, 'claim')}
                >
                  {pendingId === selectedTicket.id ? 'Claiming…' : 'Claim Request Now'}
                </button>
              ) : (
                confirmUnclaimId === selectedTicket.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--red-deep)' }}>Confirm release?</span>
                    <button
                      type="button"
                      className="volunteer-ticket-undo"
                      onClick={() => void changeClaim(selectedTicket, 'unclaim')}
                      disabled={pendingId !== null}
                    >
                      Yes, Release
                    </button>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--ink-3)' }}
                      onClick={() => setConfirmUnclaimId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="volunteer-ticket-undo"
                    onClick={() => setConfirmUnclaimId(selectedTicket.id)}
                    disabled={pendingId !== null}
                  >
                    Release Claim
                  </button>
                )
              )}
              <button
                type="button"
                className="volunteer-modal-dismiss-btn"
                onClick={() => setSelectedTicketId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
