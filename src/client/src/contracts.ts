/**
 * JSON contracts for the v1 help API.
 * Keep these field names aligned with the Pydantic models in `src/server`.
 */

export type UrgencyLevel = "urgent" | "today" | "this_week";

export type ServiceCategory = "food" | "ride" | "shelter" | "warmth" | "support" | "other";

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

export interface SurveyAccepted {
  token: string;
  status: TicketStatus;
  urgency: UrgencyLevel;
  category: ServiceCategory;
  summary: string;
  suggested_service_id?: string | null;
  service: ServiceMatch;
}

export interface TimelineEvent {
  at: string;
  status: TicketStatus;
  label: string;
}

export interface PublicTicket {
  token: string;
  status: TicketStatus;
  urgency: UrgencyLevel;
  category: ServiceCategory;
  summary: string;
  district?: string | null;
  language: string;
  assigned_volunteer_alias?: string | null;
  suggested_service_id?: string | null;
  service: ServiceMatch;
  timeline: TimelineEvent[];
}

export interface CommunityResource {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  hours_description: string;
  is_staffed: boolean;
  no_id_required: boolean;
}

export interface SafePlace extends CommunityResource {
  district: string;
}

export interface Pantry extends CommunityResource {
  district: string;
  accessibility_notes: string;
  open_now: boolean;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: CommunityResource;
  }>;
}

export interface SafeWalkFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: Array<[number, number]> };
  properties: {
    destination_id: string;
    destination_name: string;
    address: string;
    lit_corridor: boolean;
    instructions: string[];
    checkpoints: Array<{
      name: string;
      latitude: number;
      longitude: number;
      emergency: boolean;
    }>;
  };
}

export const apiPaths = {
  survey: "/api/v1/intake/survey",
  ticket: "/api/v1/intake/tickets",
  safePlaces: "/api/v1/resources/safe-places",
  pantries: "/api/v1/resources/pantries",
  safeWalk: "/api/v1/routes/safe-walk",
  queue: "/api/v1/coordinator/queue",
  assign: "/api/v1/coordinator/tickets",
} as const;
