/**
 * Intake survey and triage contracts.
 * Keep these field names aligned with `src/server/intake/schema.py`.
 */

export type UrgencyLevel = "urgent" | "today" | "this_week";

export type ServiceCategory =
  | "food"
  | "ride"
  | "shelter"
  | "warmth"
  | "support"
  | "other";

export type TicketStatus = "pending" | "assigned" | "in_progress" | "resolved";

export interface SurveyRequest {
  selected_options: string[];
  free_text?: string | null;
  district?: string | null;
  language: string;
}

export interface TriageResult {
  urgency: UrgencyLevel;
  category: ServiceCategory;
  summary: string;
  suggested_service_id?: string | null;
}

export interface ServiceMatch {
  id: string;
  name: string;
  category: ServiceCategory;
  summary: string;
  next_step: string;
}
