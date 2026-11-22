import { Check } from 'lucide-react';
import type { TicketStatus, TimelineEvent } from '../../contracts/intake';
import { useSurvey } from '../../state/survey';
import './status.css';

export const STAGES: TicketStatus[] = ['pending', 'assigned', 'in_progress', 'resolved'];

function timeOf(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Resident timeline (#15): every stage is listed so people can see what comes next. Stages reached
 * show a check and the time; the current one is ringed. Labels are plain words, not status codes.
 */
export function StatusTimeline({ status, events }: { status: TicketStatus; events: TimelineEvent[] }) {
  const { t } = useSurvey();
  const current = STAGES.indexOf(status);
  return (
    <ol className="tl" aria-label="Progress">
      {STAGES.map((stage, i) => {
        const state = status === 'resolved' || i < current ? 'done' : i === current ? 'now' : 'later';
        const at = events.find((e) => e.status === stage)?.at;
        return (
          <li key={stage} className={state} aria-current={i === current ? 'step' : undefined}>
            <span className="dot" aria-hidden="true">
              {state === 'done' && <Check />}
            </span>
            <span>
              <b>{t(`tl.${stage}`)}</b>
              <small>{t(`tl.${stage}.d`)}</small>
            </span>
            <span className="meta">{state === 'later' ? '' : timeOf(at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
