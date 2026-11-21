import { useEffect, useMemo, useState } from 'react';
import type {
  CoordinatorTicket,
  TicketStatus,
  UrgencyLevel,
  ServiceCategory,
} from '../contracts/coordinator';
import './CoordinatorDashboard.css';

const SAMPLE_COORDINATOR_TICKETS: CoordinatorTicket[] = [
  {
    ticket_id: 't-101',
    token: 'tok-juneau-01',
    status: 'pending',
    urgency: 'urgent',
    category: 'safe_place',
    summary: 'Seeking immediate shelter and warm room near Juneautown',
    district: 'Juneautown',
    language: 'en',
    volunteer_id: null,
    volunteer_alias: null,
    notes: 'Referred to Sojourner intake hotline.',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    ticket_id: 't-102',
    token: 'tok-west-02',
    status: 'assigned',
    urgency: 'today',
    category: 'food',
    summary: 'Emergency grocery delivery needed for homebound family with toddler',
    district: 'Near West Side',
    language: 'es',
    volunteer_id: 'v-042',
    volunteer_alias: 'Cedar',
    notes: 'Pantry package dispatched from Friedens.',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    ticket_id: 't-103',
    token: 'tok-msoe-03',
    status: 'pending',
    urgency: 'urgent',
    category: 'ride',
    summary: 'Escort requested from Diercks Hall to Broadway campus safety center',
    district: 'MSOE Campus',
    language: 'en',
    volunteer_id: null,
    volunteer_alias: null,
    notes: 'Campus public safety escort requested.',
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    ticket_id: 't-104',
    token: 'tok-ward-04',
    status: 'in_progress',
    urgency: 'this_week',
    category: 'talk',
    summary: 'Support check-in and resource connection for local artist elder',
    district: 'Historic Third Ward',
    language: 'en',
    volunteer_id: 'v-089',
    volunteer_alias: 'Harbor',
    notes: 'Scheduled for Friday afternoon call.',
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    ticket_id: 't-105',
    token: 'tok-south-05',
    status: 'pending',
    urgency: 'today',
    category: 'food',
    summary: 'Baby formula and warm blanket request near Mitchell Street',
    district: 'Near South Side',
    language: 'es',
    volunteer_id: null,
    volunteer_alias: null,
    notes: 'HTF Resource Center contacted.',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

const URGENCY_WEIGHT: Record<UrgencyLevel, number> = {
  urgent: 3,
  today: 2,
  this_week: 1,
};

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  food: 'Food Pantry',
  safe_place: 'Safe Haven',
  warm_lobby: 'Warm Lobby',
  talk: 'Listening / Talk',
  ride: 'Safe Ride',
  other: 'General Support',
};

export default function CoordinatorDashboard() {
  const [tickets, setTickets] = useState<CoordinatorTicket[]>(SAMPLE_COORDINATOR_TICKETS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sorting state (criteria: sorting by time and urgency)
  const [sortField, setSortField] = useState<'time' | 'urgency'>('urgency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Single-row assign/edit modal
  const [activeModalTicket, setActiveModalTicket] = useState<CoordinatorTicket | null>(null);
  const [assignVolunteerId, setAssignVolunteerId] = useState<string>('v-dispatch-01');
  const [assignStatus, setAssignStatus] = useState<TicketStatus>('assigned');
  const [assignNotes, setAssignNotes] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/coordinator/queue', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (data?.tickets && Array.isArray(data.tickets) && data.tickets.length > 0) {
          setTickets(data.tickets);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  // District summary counts for badges
  const districtCounts = useMemo(() => {
    const counts: Record<string, { total: number; urgent: number }> = {};
    for (const ticket of tickets) {
      const d = ticket.district || 'Unassigned';
      if (!counts[d]) counts[d] = { total: 0, urgent: 0 };
      counts[d].total += 1;
      if (ticket.urgency === 'urgent') counts[d].urgent += 1;
    }
    return counts;
  }, [tickets]);

  // Filtering & Sorting
  const displayedTickets = useMemo(() => {
    const filtered = tickets.filter((t) => {
      if (districtFilter !== 'all' && (t.district || 'Unassigned') !== districtFilter) return false;
      if (urgencyFilter !== 'all' && t.urgency !== urgencyFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesSummary = t.summary.toLowerCase().includes(query);
        const matchesId = t.ticket_id.toLowerCase().includes(query);
        const matchesVolunteer = t.volunteer_alias?.toLowerCase().includes(query);
        if (!matchesSummary && !matchesId && !matchesVolunteer) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortField === 'urgency') {
        const diff = URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency];
        return sortOrder === 'desc' ? diff : -diff;
      } else {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }
    });

    return filtered;
  }, [tickets, districtFilter, urgencyFilter, statusFilter, searchTerm, sortField, sortOrder]);

  const toggleSort = (field: 'time' | 'urgency') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayedTickets.map((t) => t.ticket_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch status update
  const handleBatchStatusUpdate = (newStatus: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) => (selectedIds.has(t.ticket_id) ? { ...t, status: newStatus } : t))
    );
    setSelectedIds(new Set());
  };

  // Batch prioritize
  const handleBatchPrioritize = () => {
    setTickets((prev) =>
      prev.map((t) => (selectedIds.has(t.ticket_id) ? { ...t, urgency: 'urgent' } : t))
    );
    setSelectedIds(new Set());
  };

  // Single row quick action
  const openAssignModal = (ticket: CoordinatorTicket) => {
    setActiveModalTicket(ticket);
    setAssignVolunteerId(ticket.volunteer_id || 'v-mke-volunteer');
    setAssignStatus(ticket.status === 'pending' ? 'assigned' : ticket.status);
    setAssignNotes(ticket.notes || '');
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalTicket) return;

    const updated: CoordinatorTicket = {
      ...activeModalTicket,
      volunteer_id: assignVolunteerId,
      volunteer_alias: assignVolunteerId.replace('v-', 'Relay-').toUpperCase(),
      status: assignStatus,
      notes: assignNotes,
    };

    setTickets((prev) =>
      prev.map((t) => (t.ticket_id === activeModalTicket.ticket_id ? updated : t))
    );

    // Call API in background
    try {
      await fetch(`/api/v1/coordinator/tickets/${activeModalTicket.ticket_id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteer_id: assignVolunteerId,
          status: assignStatus,
          notes: assignNotes || undefined,
        }),
      });
    } catch {
      // Keep optimistic update
    }

    setActiveModalTicket(null);
  };

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <main className="coordinator-dashboard" aria-labelledby="coordinator-title">
      <div className="coordinator-header">
        <h2 id="coordinator-title">Coordinator Dispatch Queue</h2>
        <p>Live district triage &amp; volunteer allocation queue for Milwaukee emergency requests.</p>
      </div>

      {/* District summary badges at the top of the view */}
      <section aria-label="District Summaries" className="coordinator-district-badges">
        <button
          type="button"
          className={`coordinator-badge-pill ${districtFilter === 'all' ? 'coordinator-badge-pill--active' : ''}`}
          onClick={() => setDistrictFilter('all')}
        >
          All Districts <span className="coordinator-badge-count">{tickets.length}</span>
        </button>
        {Object.entries(districtCounts).map(([dist, info]) => (
          <button
            key={dist}
            type="button"
            className={`coordinator-badge-pill ${districtFilter === dist ? 'coordinator-badge-pill--active' : ''}`}
            onClick={() => setDistrictFilter(dist)}
          >
            {dist}{' '}
            <span className={`coordinator-badge-count ${info.urgent > 0 ? 'coordinator-badge-count--urgent' : ''}`}>
              {info.total} {info.urgent > 0 ? `(${info.urgent} urgent)` : ''}
            </span>
          </button>
        ))}
      </section>

      {/* Controls & Batch Action Bar */}
      <div className="coordinator-toolbar">
        <div className="coordinator-search-filters">
          <input
            type="search"
            placeholder="Search request or ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="coordinator-search-input"
            aria-label="Search requests"
          />
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="coordinator-select"
            aria-label="Filter by urgency"
          >
            <option value="all">All Urgencies</option>
            <option value="urgent">Urgent</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="coordinator-select"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="coordinator-batch-bar" role="group" aria-label="Batch Actions">
            <strong>{selectedIds.size} selected</strong>
            <button
              type="button"
              className="coordinator-batch-btn"
              onClick={() => handleBatchStatusUpdate('assigned')}
            >
              Mark Assigned
            </button>
            <button
              type="button"
              className="coordinator-batch-btn"
              onClick={() => handleBatchStatusUpdate('in_progress')}
            >
              Mark In Progress
            </button>
            <button
              type="button"
              className="coordinator-batch-btn"
              onClick={handleBatchPrioritize}
            >
              Prioritize (Urgent)
            </button>
            <button
              type="button"
              className="coordinator-batch-btn"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table: Responsive data table */}
      <div className="coordinator-table-container">
        <table className="coordinator-table" aria-label="Incoming request dispatch table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={displayedTickets.length > 0 && selectedIds.size === displayedTickets.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th
                className="coordinator-sortable-header"
                onClick={() => toggleSort('time')}
                title="Sort by time"
              >
                Time {sortField === 'time' ? (sortOrder === 'desc' ? '▼' : '▲') : '↕'}
              </th>
              <th>District</th>
              <th>Category</th>
              <th
                className="coordinator-sortable-header"
                onClick={() => toggleSort('urgency')}
                title="Sort by urgency"
              >
                Urgency {sortField === 'urgency' ? (sortOrder === 'desc' ? '▼' : '▲') : '↕'}
              </th>
              <th>Status</th>
              <th>Assigned Volunteer</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedTickets.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-3)' }}>
                  No requests match the current filters.
                </td>
              </tr>
            ) : (
              displayedTickets.map((t) => {
                const isSelected = selectedIds.has(t.ticket_id);
                return (
                  <tr key={t.ticket_id} className={isSelected ? 'coordinator-row--selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(t.ticket_id)}
                        aria-label={`Select ticket ${t.ticket_id}`}
                      />
                    </td>
                    <td>
                      <strong>{formatTime(t.created_at)}</strong>
                    </td>
                    <td>{t.district || 'Unassigned'}</td>
                    <td>{CATEGORY_LABELS[t.category] || t.category}</td>
                    <td>
                      <span className={`coordinator-urgency-badge coordinator-urgency--${t.urgency}`}>
                        {t.urgency.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`coordinator-status-badge coordinator-status--${t.status}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {t.volunteer_alias ? (
                        <span style={{ fontWeight: 600, color: 'var(--police)' }}>{t.volunteer_alias}</span>
                      ) : (
                        <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="coordinator-actions-cell">
                        <button
                          type="button"
                          className="coordinator-action-btn coordinator-action-btn--primary"
                          onClick={() => openAssignModal(t)}
                        >
                          {t.volunteer_id ? 'Reassign' : 'Assign'}
                        </button>
                        <button
                          type="button"
                          className="coordinator-action-btn"
                          onClick={() => {
                            setTickets((prev) =>
                              prev.map((item) =>
                                item.ticket_id === t.ticket_id
                                  ? { ...item, urgency: item.urgency === 'urgent' ? 'today' : 'urgent' }
                                  : item
                              )
                            );
                          }}
                        >
                          {t.urgency === 'urgent' ? 'De-escalate' : 'Prioritize'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Assign / Edit Modal */}
      {activeModalTicket && (
        <div
          className="coordinator-modal-backdrop"
          role="presentation"
          onClick={() => setActiveModalTicket(null)}
        >
          <div
            className="coordinator-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="assign-modal-title">Dispatch Action: {activeModalTicket.ticket_id}</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-2)', margin: '0 0 1rem' }}>
              {activeModalTicket.summary}
            </p>

            <form onSubmit={handleSaveAssignment} className="coordinator-modal-form">
              <label>
                Volunteer Identifier / Call Sign:
                <input
                  type="text"
                  required
                  value={assignVolunteerId}
                  onChange={(e) => setAssignVolunteerId(e.target.value)}
                  className="coordinator-search-input"
                />
              </label>

              <label>
                Status Progression:
                <select
                  value={assignStatus}
                  onChange={(e) => setAssignStatus(e.target.value as TicketStatus)}
                  className="coordinator-select"
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>

              <label>
                Dispatch Notes (Scrubbed for PII):
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="coordinator-search-input"
                  style={{ resize: 'vertical' }}
                  placeholder="Relay coordination instructions..."
                />
              </label>

              <div className="coordinator-modal-actions">
                <button
                  type="button"
                  className="coordinator-action-btn"
                  onClick={() => setActiveModalTicket(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="coordinator-action-btn coordinator-action-btn--primary"
                >
                  Update Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
