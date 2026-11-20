import {
  apiPaths,
  type PublicTicket,
  type ServiceCategory,
  type SurveyAccepted,
  type SurveyRequest,
  type TicketStatus,
  type TriageResult,
  type UrgencyLevel,
} from '../contracts';
import { translate, type Language } from '../i18n/strings';

/**
 * Client for the anonymous intake API (PR #50). When the server is not running, every call falls back
 * to sample data held in memory so the resident flow can still be demoed. Results from the fallback
 * carry `sample: true` so the UI can say so.
 */

const TIMEOUT_MS = 8000;

/** Not in PR #50 yet: a triage preview that does not create a ticket. Until it exists, `previewTriage` uses the local guess. */
const TRIAGE_PREVIEW_PATH = '/api/v1/intake/triage';

export type Sampled<T> = T & { sample?: boolean };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) throw new ApiError(res.status);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  constructor(public status: number) {
    super(`Request failed with ${status}`);
  }
}

/** True when the failure means "no server here" rather than "the server said no". */
function serverMissing(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 404 || err.status >= 500;
  return true; // network error, abort, bad JSON
}

// ---------- triage preview (#6) ----------

const NEED_CATEGORY: Record<string, ServiceCategory> = {
  food: 'food',
  ride: 'ride',
  safe: 'shelter',
  warm: 'warmth',
  talk: 'support',
  other: 'other',
};

/** Whole-word match that also works for accented words (plain `\b` is ASCII-only). English + Spanish. */
function words(...list: string[]): RegExp {
  return new RegExp(`(?<!\\p{L})(${list.join('|')})(?!\\p{L})`, 'iu');
}

const URGENT_WORDS = words(
  'tonight', 'now', 'right away', 'emergency', 'unsafe', 'scared', 'hurt', 'danger', 'no heat', 'freezing', 'kids?', 'baby',
  'esta noche', 'ahora', 'urgente', 'emergencia', 'miedo', 'peligro', 'niños', 'hij[oa]s', 'bebé',
);
const TODAY_WORDS = words('today', 'this evening', 'soon', 'hungry', 'hoy', 'esta tarde', 'pronto', 'hambre');

const KEYWORD_CATEGORY: Array<[RegExp, ServiceCategory]> = [
  [words('food', 'hungry', 'groceries', 'formula', 'meal', 'eat', 'comida', 'hambre', 'despensa', 'leche', 'fórmula'), 'food'],
  [words('ride', 'car', 'bus', 'drive', 'appointment', 'clinic', 'transporte', 'carro', 'coche', 'autobús', 'cita', 'clínica'), 'ride'],
  [words('safe', 'unsafe', 'scared', 'abuse', 'leave', 'hide', 'shelter', 'seguro', 'segura', 'miedo', 'abuso', 'refugio'), 'shelter'],
  [words('cold', 'warm', 'heat', 'coat', 'freezing', 'frío', 'calefacción', 'abrigo'), 'warmth'],
  [words('talk', 'lonely', 'grief', 'sad', 'hablar', 'triste', 'duelo'), 'support'],
];

/**
 * A cautious stand-in for the AI layer: plain keyword rules, so the review card has something to show
 * offline. The real triage (#33–#37) replaces this through `previewTriage`.
 */
export function localTriage(req: SurveyRequest): TriageResult {
  const lang: Language = req.language === 'es' ? 'es' : 'en';
  const text = req.free_text?.trim() ?? '';
  const preset = req.selected_options[0];
  let category: ServiceCategory = preset ? NEED_CATEGORY[preset] ?? 'other' : 'other';
  if (category === 'other') category = KEYWORD_CATEGORY.find(([re]) => re.test(text))?.[1] ?? 'other';
  const urgency: UrgencyLevel =
    category === 'shelter' || URGENT_WORDS.test(text) ? 'urgent' : TODAY_WORDS.test(text) || category === 'food' ? 'today' : 'this_week';
  let summary = translate(lang, 'triage.need', { what: translate(lang, `triage.what.${category}`) });
  if (text) summary += ` ${translate(lang, 'triage.words', { text: clip(text, 140) })}`;
  return { urgency, category, summary };
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function previewTriage(req: SurveyRequest): Promise<Sampled<TriageResult>> {
  try {
    return await request<TriageResult>(TRIAGE_PREVIEW_PATH, { method: 'POST', body: JSON.stringify(req) });
  } catch (err) {
    if (!serverMissing(err)) throw err;
    return { ...localTriage(req), sample: true };
  }
}

// ---------- submit + lookup (#15) ----------

interface MockTicket {
  ticket: PublicTicket;
  createdAt: number;
}

const mockTickets = new Map<string, MockTicket>();

/** Called by Quick Exit so no request text survives in memory. */
export function clearSampleTickets(): void {
  mockTickets.clear();
}

/** Same shape as the server's tokens: `cf-` plus 6 characters from an alphabet without look-alikes. */
function newToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `cf-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

/** Accepts "cf-ab12cd", "CF-AB12CD" or just "AB12CD". */
export function normalizeToken(input: string): string {
  const body = input.trim().replace(/^cf-/i, '').toUpperCase();
  return body ? `cf-${body}` : '';
}

export async function submitSurvey(req: SurveyRequest, triage: TriageResult): Promise<Sampled<SurveyAccepted>> {
  try {
    return await request<SurveyAccepted>(apiPaths.survey, { method: 'POST', body: JSON.stringify(req) });
  } catch (err) {
    if (!serverMissing(err)) throw err;
  }
  const token = newToken();
  const now = new Date();
  const service = {
    id: `sample-${triage.category}`,
    name: 'ComForce dispatch',
    category: triage.category,
    summary: 'A ComForce coordinator reviews every request.',
    next_step: 'A volunteer will be matched to you.',
  };
  const ticket: PublicTicket = {
    token,
    status: 'pending',
    urgency: triage.urgency,
    category: triage.category,
    summary: triage.summary,
    district: req.district,
    language: req.language,
    assigned_volunteer_alias: null,
    service,
    timeline: [{ at: now.toISOString(), status: 'pending', label: 'Request sent' }],
  };
  mockTickets.set(token, { ticket, createdAt: now.getTime() });
  return { token, status: 'pending', urgency: triage.urgency, category: triage.category, summary: triage.summary, service, sample: true };
}

/** Sample tickets move forward on their own so the timeline can be demoed: assigned at 20 s, on the way at 60 s. */
const SAMPLE_STEPS: Array<{ after: number; status: TicketStatus; label: string }> = [
  { after: 20_000, status: 'assigned', label: 'Volunteer took it' },
  { after: 60_000, status: 'in_progress', label: 'On the way' },
];

function advanceSample(m: MockTicket): PublicTicket {
  const elapsed = Date.now() - m.createdAt;
  const timeline = [...m.ticket.timeline];
  let status = m.ticket.status;
  let alias = m.ticket.assigned_volunteer_alias;
  for (const step of SAMPLE_STEPS) {
    if (elapsed < step.after) break;
    status = step.status;
    alias = 'Marcus T.';
    if (!timeline.some((e) => e.status === step.status)) {
      timeline.push({ at: new Date(m.createdAt + step.after).toISOString(), status: step.status, label: step.label });
    }
  }
  return { ...m.ticket, status, assigned_volunteer_alias: alias, timeline };
}

export type TicketLookup = { kind: 'found'; ticket: Sampled<PublicTicket> } | { kind: 'not-found' };

export async function getTicket(token: string): Promise<TicketLookup> {
  const clean = normalizeToken(token);
  if (clean.length < 4) return { kind: 'not-found' };
  const sample = mockTickets.get(clean);
  if (sample) return { kind: 'found', ticket: { ...advanceSample(sample), sample: true } };
  try {
    const ticket = await request<PublicTicket>(`${apiPaths.ticket}/${encodeURIComponent(clean)}`);
    return { kind: 'found', ticket };
  } catch (err) {
    if (serverMissing(err)) return { kind: 'not-found' };
    throw err; // 429 and other refusals go to the screen as errors
  }
}
