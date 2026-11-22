import { apiFetch } from '../api/transport';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  AssignRequest,
  CoordinatorTicket,
  QueueCounts,
  QueuePage,
  TicketStatus,
  ServiceCategory,
} from '../contracts/coordinator';
import { coordinatorHeaders } from '../coordinator/access';
import './CoordinatorDashboard.css';

export const SAMPLE_COORDINATOR_TICKETS: CoordinatorTicket[] = [
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

const NEXT_STATUS: Partial<Record<TicketStatus, { value: TicketStatus; label: string }>> = {
  pending: { value: 'assigned', label: 'Assigned' },
  assigned: { value: 'in_progress', label: 'In progress' },
  in_progress: { value: 'resolved', label: 'Resolved' },
};

const SAVE_FAILURE = 'We couldn’t confirm this update. Check the request or try again.';
const SAVE_ERRORS: Partial<Record<number, string>> = {
  401: 'Your staff access has expired. Sign out and sign back in.',
  403: 'Your coordinator key was rejected. Sign out and sign back in.',
  404: 'This request is no longer available in the queue.',
  409: 'This update conflicts with the current assignment or status. Check the latest request before retrying.',
  422: 'Check the volunteer ID and dispatch notes, then try again.',
};
const SAVE_TIMEOUT_MS = 10_000;

export default function CoordinatorDashboard({ accessKey }: { accessKey: string }) {
  const [tickets, setTickets] = useState<CoordinatorTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;
  const [totalMatching, setTotalMatching] = useState<number>(0);
  const [serverCounts, setServerCounts] = useState<QueueCounts | null>(null);
  const [queueVersion, setQueueVersion] = useState(0);
  const queueRequest = useRef<AbortController | null>(null);

  // Sorting state (criteria: sorting by time and urgency)
  const [sortField, setSortField] = useState<'time' | 'urgency'>('urgency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Single-row assign/edit modal
  const [activeModalTicket, setActiveModalTicket] = useState<CoordinatorTicket | null>(null);
  const [assignVolunteerId, setAssignVolunteerId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const nextStatus = activeModalTicket ? NEXT_STATUS[activeModalTicket.status] : undefined;

  const updateDistrict = (d: string) => { setDistrictFilter(d); setCurrentPage(1); };
  const updateUrgency = (u: string) => { setUrgencyFilter(u); setCurrentPage(1); };
  const updateStatus = (s: string) => { setStatusFilter(s); setCurrentPage(1); };
  const updateSearch = (q: string) => { setSearchTerm(q); setCurrentPage(1); };

  const isDemoQueue = useMemo(
    () => tickets.some((t) => t.ticket_id.startsWith('cf-DEM')),
    [tickets]
  );

  useEffect(() => {
    const controller = new AbortController();
    queueRequest.current = controller;
    setIsLoading(true);
    setLoadError(null);

    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String((currentPage - 1) * pageSize));
    if (districtFilter !== 'all') params.set('district', districtFilter);
    if (urgencyFilter !== 'all') params.set('urgency', urgencyFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('sort_by', sortField);
    params.set('sort_order', sortOrder);

    apiFetch(`/api/v1/coordinator/queue?${params.toString()}`, {
      signal: controller.signal,
      headers: coordinatorHeaders(accessKey),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const data: QueuePage = await res.json();
        if (controller.signal.aborted) return;
        if (!Array.isArray(data?.tickets)) throw new Error('Unexpected queue response');
        const headerTotal = Number.parseInt(res.headers.get('X-Total-Count') ?? '', 10);
        const total = data.counts?.total_matching ?? (Number.isNaN(headerTotal) ? data.tickets.length : headerTotal);
        setTickets(data.tickets);
        setServerCounts(data.counts ?? null);
        setTotalMatching(total);
        setIsLoading(false);
        const lastPage = Math.max(1, Math.ceil(total / pageSize));
        if (currentPage > lastPage) setCurrentPage(lastPage);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        setLoadError(err?.message || 'Failed to load queue');
        setTickets([]);
        setServerCounts(null);
        setTotalMatching(0);
      });

    return () => controller.abort();
  }, [accessKey, currentPage, pageSize, districtFilter, urgencyFilter, statusFilter, searchTerm, sortField, sortOrder, queueVersion]);

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

  const toggleSort = (field: 'time' | 'urgency') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const refreshQueue = () => {
    queueRequest.current?.abort();
    setQueueVersion((version) => version + 1);
  };

  // Single row quick action
  const openAssignModal = (ticket: CoordinatorTicket) => {
    setActiveModalTicket(ticket);
    setAssignVolunteerId(ticket.volunteer_id ?? '');
    setAssignNotes(ticket.notes ?? '');
    setSaveError('');
  };

  const closeAssignModal = () => {
    if (!saving) setActiveModalTicket(null);
  };

  const handleSaveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const volunteerId = assignVolunteerId.trim();
    if (saving || !activeModalTicket || !nextStatus || !volunteerId) return;

    const payload: AssignRequest = {
      volunteer_id: volunteerId,
      status: nextStatus.value,
      notes: assignNotes.trim() || undefined,
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    setSaving(true);
    setSaveError('');

    try {
      const response = await apiFetch(`/api/v1/coordinator/tickets/${encodeURIComponent(activeModalTicket.ticket_id)}/assign`, {
        method: 'PATCH',
        headers: coordinatorHeaders(accessKey, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        setSaveError(SAVE_ERRORS[response.status] ?? SAVE_FAILURE);
        if (response.status === 404 || response.status === 409) refreshQueue();
        return;
      }

      const saved: CoordinatorTicket = await response.json();
      if (saved?.ticket_id !== activeModalTicket.ticket_id) {
        setSaveError(SAVE_FAILURE);
        return;
      }

      refreshQueue();
      setTickets((current) => current.map((ticket) => ticket.ticket_id === saved.ticket_id ? saved : ticket));
      setActiveModalTicket(null);
    } catch {
      setSaveError(SAVE_FAILURE);
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
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
          <p>
            Live triage and volunteer dispatch for Milwaukee requests. AI sorts by urgency, you decide.
            {isDemoQueue && <span className="demo-flag">Demo Fixtures (Sample Data)</span>}
          </p>
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

      {/* Queue filters */}
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
      </div>

      {/* Table: Responsive data table */}
      <div className="coordinator-table-container">
        <table className="coordinator-table" aria-label="Incoming request dispatch table">
          <thead>
            <tr>
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
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-3)' }}>
                  Loading queue tickets…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--red, #ef4444)' }}>
                  {loadError}. Queue is currently unavailable.
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-3)' }}>
                  No requests match the current filters.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.ticket_id}>
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
                    {NEXT_STATUS[t.status] && (
                      <button
                        type="button"
                        className="coordinator-action-btn coordinator-action-btn--primary"
                        onClick={() => openAssignModal(t)}
                      >
                        {t.status === 'pending' ? 'Assign' : 'Update status'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
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

      {activeModalTicket && nextStatus && (
        <div
          className="coordinator-modal-backdrop"
          role="presentation"
          onClick={closeAssignModal}
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

            <form onSubmit={handleSaveAssignment} className="coordinator-modal-form" aria-busy={saving}>
              <label>
                Volunteer ID or call sign
                <input
                  type="text"
                  required
                  maxLength={80}
                  disabled={saving}
                  readOnly={Boolean(activeModalTicket.volunteer_id)}
                  value={assignVolunteerId}
                  onChange={(e) => setAssignVolunteerId(e.target.value)}
                  className="coordinator-search-input"
                />
              </label>

              <p className="meta">Status after saving <strong>{nextStatus.label}</strong></p>

              <label>
                Dispatch notes
                <textarea
                  rows={3}
                  maxLength={500}
                  disabled={saving}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="coordinator-search-input"
                  style={{ resize: 'vertical' }}
                  placeholder="Relay coordination instructions..."
                />
              </label>

              {saveError && <p className="coordinator-save-error" role="alert">{saveError}</p>}

              <div className="coordinator-modal-actions">
                <button
                  type="button"
                  className="coordinator-action-btn"
                  disabled={saving}
                  onClick={closeAssignModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="coordinator-action-btn coordinator-action-btn--primary"
                  disabled={saving || !assignVolunteerId.trim()}
                >
                  {saving ? 'Saving…' : 'Update ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
