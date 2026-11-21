import { useEffect, useMemo, useState } from 'react';
import type {
  CoordinatorTicket,
  TicketStatus,
  ServiceCategory,
} from '../contracts/coordinator';
import { coordinatorHeaders } from '../coordinator/access';
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

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  food: 'Food Pantry',
  safe_place: 'Safe Haven',
  warm_lobby: 'Warm Lobby',
  talk: 'Listening / Talk',
  ride: 'Safe Ride',
  other: 'General Support',
};

export default function CoordinatorDashboard({ accessKey }: { accessKey: string }) {
  const [tickets, setTickets] = useState<CoordinatorTicket[]>(SAMPLE_COORDINATOR_TICKETS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;
  const [totalMatching, setTotalMatching] = useState<number>(SAMPLE_COORDINATOR_TICKETS.length);
  const [serverCounts, setServerCounts] = useState<{
    total_urgent: number;
    total_pending: number;
    total_open?: number;
    total_matching?: number;
    district_counts?: Record<string, { total: number; urgent: number }>;
  } | null>(null);

  // Sorting state (criteria: sorting by time and urgency)
  const [sortField, setSortField] = useState<'time' | 'urgency'>('urgency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Single-row assign/edit modal
  const [activeModalTicket, setActiveModalTicket] = useState<CoordinatorTicket | null>(null);
  const [assignVolunteerId, setAssignVolunteerId] = useState<string>('v-dispatch-01');
  const [assignStatus, setAssignStatus] = useState<TicketStatus>('assigned');
  const [assignNotes, setAssignNotes] = useState<string>('');

  const updateDistrict = (d: string) => { setDistrictFilter(d); setCurrentPage(1); };
  const updateUrgency = (u: string) => { setUrgencyFilter(u); setCurrentPage(1); };
  const updateStatus = (s: string) => { setStatusFilter(s); setCurrentPage(1); };
  const updateSearch = (q: string) => { setSearchTerm(q); setCurrentPage(1); };

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String((currentPage - 1) * pageSize));
    if (districtFilter !== 'all') params.set('district', districtFilter);
    if (urgencyFilter !== 'all') params.set('urgency', urgencyFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('sort_by', sortField);
    params.set('sort_order', sortOrder);

    fetch(`/api/v1/coordinator/queue?${params.toString()}`, {
      signal: controller.signal,
      headers: coordinatorHeaders(accessKey),
    })
      .then((res) => {
        if (!res.ok) return;
        const total = res.headers.get('X-Total-Count');
        if (total !== null) setTotalMatching(parseInt(total, 10) || 0);
        return res.json();
      })
      .then((data) => {
        if (data?.tickets && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
        }
        if (data?.counts) {
          setServerCounts(data.counts);
          if (data.counts.total_matching !== undefined) {
            setTotalMatching(data.counts.total_matching);
          }
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [accessKey, currentPage, pageSize, districtFilter, urgencyFilter, statusFilter, searchTerm, sortField, sortOrder]);

  // District summary counts for badges
  const districtCounts = useMemo(() => {
    if (serverCounts?.district_counts && Object.keys(serverCounts.district_counts).length > 0) {
      return serverCounts.district_counts;
    }
    const counts: Record<string, { total: number; urgent: number }> = {};
    for (const ticket of tickets) {
      const d = ticket.district || 'Unassigned';
      if (!counts[d]) counts[d] = { total: 0, urgent: 0 };
      counts[d].total += 1;
      if (ticket.urgency === 'urgent') counts[d].urgent += 1;
    }
    return counts;
  }, [tickets, serverCounts]);

  const totalTickets = useMemo(() => {
    return Object.values(districtCounts).reduce((acc, c) => acc + c.total, 0);
  }, [districtCounts]);

  // Headline numbers for the KPI tiles
  const kpis = useMemo(() => {
    const now = Date.now();
    const waiting = tickets.filter((t) => t.status === 'pending' && !t.volunteer_id);
    const oldest = waiting.reduce<number | null>((min, t) => {
      const created = new Date(t.created_at).getTime();
      return min === null || created < min ? created : min;
    }, null);
    return {
      urgentUnassigned: serverCounts?.total_urgent ?? waiting.filter((t) => t.urgency === 'urgent').length,
      open: serverCounts?.total_open ?? tickets.filter((t) => t.status !== 'resolved').length,
      volunteersOut: new Set(
        tickets
          .filter((t) => (t.status === 'assigned' || t.status === 'in_progress') && t.volunteer_id)
          .map((t) => t.volunteer_id),
      ).size,
      oldestWaitingMin: oldest === null ? null : Math.max(0, Math.round((now - oldest) / 60000)),
    };
  }, [tickets, serverCounts]);

  // Displayed tickets are returned sorted and paged by server
  const displayedTickets = tickets;

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
        headers: coordinatorHeaders(accessKey, { 'Content-Type': 'application/json' }),
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
      <div className="pagehead">
        <div>
          <h1 id="coordinator-title">Tonight, across the district</h1>
          <p>Live triage and volunteer dispatch for Milwaukee requests. AI sorts by urgency, you decide.</p>
        </div>
      </div>

      <section className="kpis" aria-label="Queue summary">
        <div className={kpis.urgentUnassigned > 0 ? 'kpi bad' : 'kpi'}>
          <span>Urgent, nobody has it</span>
          <b>{kpis.urgentUnassigned}</b>
          <small>{kpis.urgentUnassigned > 0 ? 'Assign these first' : 'All urgent requests covered'}</small>
        </div>
        <div className="kpi">
          <span>Open requests</span>
          <b>{kpis.open}</b>
          <small>of {totalTickets} in the queue</small>
        </div>
        <div className="kpi">
          <span>Volunteers out now</span>
          <b>{kpis.volunteersOut}</b>
          <small>assigned or in progress</small>
        </div>
        <div className="kpi">
          <span>Oldest waiting</span>
          <b>{kpis.oldestWaitingMin === null ? '–' : `${kpis.oldestWaitingMin} min`}</b>
          <small>pending, unassigned</small>
        </div>
      </section>

      {/* District summary badges at the top of the view */}
      <section aria-label="District Summaries" className="coordinator-district-badges">
        <button
          type="button"
          className={`coordinator-badge-pill ${districtFilter === 'all' ? 'coordinator-badge-pill--active' : ''}`}
          onClick={() => updateDistrict('all')}
        >
          All Districts <span className="coordinator-badge-count">{totalTickets}</span>
        </button>
        {Object.entries(districtCounts).map(([dist, info]) => (
          <button
            key={dist}
            type="button"
            className={`coordinator-badge-pill ${districtFilter === dist ? 'coordinator-badge-pill--active' : ''}`}
            onClick={() => updateDistrict(dist)}
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
            onChange={(e) => updateSearch(e.target.value)}
            className="coordinator-search-input"
            aria-label="Search requests"
          />
          <select
            value={urgencyFilter}
            onChange={(e) => updateUrgency(e.target.value)}
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
            onChange={(e) => updateStatus(e.target.value)}
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
        <div
          className="coordinator-pagination"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderTop: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <div style={{ color: 'var(--ink-2, #64748b)', fontSize: '0.875rem' }}>
            Showing {totalMatching === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalMatching)} of {totalMatching} requests
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="coordinator-action-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Page {currentPage} of {Math.max(1, Math.ceil(totalMatching / pageSize))}
            </span>
            <button
              type="button"
              className="coordinator-action-btn"
              disabled={currentPage >= Math.ceil(totalMatching / pageSize)}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
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
