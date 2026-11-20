import type { TicketStatus, TimelineEvent } from '../../contracts';
import { useSurvey } from '../../state/survey';
import { Icon } from '../Icon';

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
  // Sending is instant, so "pending" already has step 1 done and is waiting on a volunteer.
  // "assigned" is waiting on the trip; "in_progress" is the trip itself.
  const nowIndex = status === 'in_progress' ? current : current + 1;
  return (
    <ol className="tl" aria-label="Progress">
      {STAGES.map((stage, i) => {
        const state = status === 'resolved' || i < nowIndex ? 'done' : i === nowIndex ? 'now' : 'later';
        const at = events.find((e) => e.status === stage)?.at;
        return (
          <li key={stage} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="dot" aria-hidden="true">
              {state === 'done' && <Icon name="check" />}
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
