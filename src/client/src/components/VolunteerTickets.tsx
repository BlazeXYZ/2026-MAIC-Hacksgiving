import { useEffect, useState } from 'react';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'claimed';
}

export default function VolunteerTickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

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
        <ul style={{ display: 'grid', gap: '0.5rem', listStyle: 'none', margin: 0, padding: 0 }}>
          {tickets.map((ticket) => (
            <li key={ticket.id} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}>
              <strong>{ticket.title}</strong>
              <p style={{ color: '#475569', margin: '0.25rem 0 0.5rem' }}>{ticket.description}</p>
              {ticket.status === 'claimed' ? (
                <strong style={{ color: '#166534' }}>Claimed</strong>
              ) : (
                <button
                  type="button"
                  aria-label={claimingId === ticket.id ? `Claiming ${ticket.title}` : `Claim Ticket: ${ticket.title}`}
                  onClick={() => void claimTicket(ticket)}
                  disabled={claimingId !== null}
                  style={{
                    backgroundColor: claimingId === null ? '#1d4ed8' : '#475569',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '4px',
                    cursor: claimingId === null ? 'pointer' : 'default',
                    fontSize: '0.85rem',
                  }}
                >
                  {claimingId === ticket.id ? 'Claiming…' : 'Claim Ticket'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
