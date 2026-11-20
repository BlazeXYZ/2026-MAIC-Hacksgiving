import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SurveyRequest } from '../contracts';
import { translate, type Language, type StringKey } from '../i18n/strings';

/** Preset needs. Issue #2 owns the cards that set these; the values match `ServiceCategory` hints. */
export type Need = 'food' | 'ride' | 'safe' | 'warm' | 'talk' | 'other';

export const NEEDS: Need[] = ['food', 'ride', 'safe', 'warm', 'talk', 'other'];

export const FREE_TEXT_MAX = 500;

export type DistrictId = 'msoe' | 'juneautown' | 'third-ward' | 'westown' | 'haymarket' | 'near-west' | 'general';

export interface District {
  id: DistrictId;
  name: string;
  hint: string;
  /** Rough centre, used only on this device to match "Use my location". Never sent to the server. */
  center?: [number, number];
}

export const DISTRICTS: District[] = [
  { id: 'msoe', name: 'MSOE Campus', hint: 'Routes to MSOE Public Safety', center: [43.0445, -87.9087] },
  { id: 'juneautown', name: 'Juneautown', hint: 'East Town, downtown east', center: [43.043, -87.904] },
  { id: 'third-ward', name: 'Historic Third Ward', hint: 'South of downtown', center: [43.0335, -87.907] },
  { id: 'westown', name: 'Westown', hint: 'Downtown west of the river', center: [43.04, -87.92] },
  { id: 'haymarket', name: 'Haymarket', hint: 'North of Westown', center: [43.046, -87.92] },
  { id: 'near-west', name: 'Near West Side', hint: 'Marquette to 35th St', center: [43.039, -87.945] },
  { id: 'general', name: 'General Milwaukee', hint: 'Anywhere else in the city' },
];

/** Answer to the welcome screen's "What brings you here today?". */
export type Intent = 'need' | 'give' | 'look';

export interface SurveyState {
  language: Language;
  intent: Intent;
  need: Need | null;
  freeText: string;
  district: DistrictId | null;
  keepPrivate: boolean;
}

const INITIAL: SurveyState = { language: 'en', intent: 'need', need: null, freeText: '', district: null, keepPrivate: true };

interface SurveyContextValue {
  survey: SurveyState;
  update: (patch: Partial<SurveyState>) => void;
  reset: () => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const SurveyContext = createContext<SurveyContextValue | null>(null);

/**
 * Holds survey answers in React memory only. Nothing is written to localStorage or sessionStorage,
 * so Quick Exit can wipe everything by remounting this provider (see `QuickExitProvider`).
 */
export function SurveyProvider({ children }: { children: ReactNode }) {
  const [survey, setSurvey] = useState<SurveyState>(INITIAL);
  const update = useCallback((patch: Partial<SurveyState>) => setSurvey((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSurvey((s) => ({ ...INITIAL, language: s.language })), []);
  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => translate(survey.language, key, vars),
    [survey.language],
  );
  const value = useMemo(() => ({ survey, update, reset, t }), [survey, update, reset, t]);
  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
}

export function useSurvey(): SurveyContextValue {
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error('useSurvey must be used inside <SurveyProvider>');
  return ctx;
}

export function freeTextProblem(text: string, required: boolean): 'empty' | 'over' | null {
  if (text.length > FREE_TEXT_MAX) return 'over';
  if (required && text.trim().length === 0) return 'empty';
  return null;
}

/** Builds the `POST /api/v1/intake/survey` body. */
export function toSurveyRequest(s: SurveyState): SurveyRequest {
  const district = DISTRICTS.find((d) => d.id === s.district);
  return {
    selected_options: s.need ? [s.need] : [],
    free_text: s.freeText.trim() || null,
    district: district?.name ?? null,
    language: s.language,
  };
}
