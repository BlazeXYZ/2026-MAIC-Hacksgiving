export type UrgencyLevel = 'urgent' | 'today' | 'this_week';
export type TicketStatus = 'pending' | 'assigned' | 'in_progress' | 'resolved';
export type ServiceCategory = 'food' | 'safe_place' | 'warm_lobby' | 'talk' | 'ride' | 'other';

export interface CoordinatorTicket {
  ticket_id: string;
  token: string;
  status: TicketStatus;
  urgency: UrgencyLevel;
  category: ServiceCategory;
  summary: string;
  district?: string | null;
  language: string;
  suggested_service_id?: string | null;
  volunteer_id?: string | null;
  volunteer_alias?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface QueueCounts {
  total_urgent: number;
  total_pending: number;
}

export interface QueuePage {
  tickets: CoordinatorTicket[];
  counts: QueueCounts;
}

export interface AssignRequest {
  volunteer_id: string;
  status: TicketStatus;
  notes?: string | null;
}
