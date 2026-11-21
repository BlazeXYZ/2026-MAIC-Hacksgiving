import { useState } from 'react';
import type { ReactElement } from 'react';
import { Icon } from '../ui/Icon';
import './UrgentAlertBanner.css';

export interface MissingPersonAlert {
  id: string;
  name: string;
  age: number;
  lastSeenLocation: string;
  lastSeenTimeAgo: string;
  description: string;
  photoUrl?: string;
  active: boolean;
  sectorsSearched?: number;
  sectorsTotal?: number;
}

export const ACTIVE_MISSING_PERSON_ALERT: MissingPersonAlert = {
  id: 'mp-mke-2026',
  name: 'Jordan Walker',
  age: 19,
  lastSeenLocation: '27th & W Wisconsin Ave',
  lastSeenTimeAgo: '45 mins ago',
  description: 'Wearing navy MSOE windbreaker, gray beanie, and tan work boots. Search parties are deploying along grid sectors A–D.',
  active: true,
  sectorsSearched: 3,
  sectorsTotal: 8,
};

interface UrgentAlertBannerProps {
  alert?: MissingPersonAlert;
  onJoinSearch: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function UrgentAlertBanner({
  alert = ACTIVE_MISSING_PERSON_ALERT,
  onJoinSearch,
}: UrgentAlertBannerProps): ReactElement | null {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If no active search is flagged or user explicitly dismissed this session, don't render
  if (!alert.active || isDismissed) {
    return null;
  }

  // Minimized: one slim line that doesn't block domestic-crisis or food seekers
  if (isMinimized) {
    return (
      <aside aria-label="Minimized Emergency Alert" className="alertcard alertcard--min">
        <div className="alert-strip">
          <span className="live" aria-hidden="true" />
          <span>Missing person search near {alert.lastSeenLocation}</span>
          <span className="alert-strip-actions">
            <button
              type="button"
              className="alert-strip-btn"
              onClick={() => setIsMinimized(false)}
              aria-label="Expand emergency missing person alert"
            >
              Show details
            </button>
            <button
              type="button"
              className="alert-strip-btn"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss alert"
            >
              <Icon name="x" />
            </button>
          </span>
        </div>
      </aside>
    );
  }

  const total = alert.sectorsTotal ?? 0;
  const searched = Math.min(alert.sectorsSearched ?? 0, total);

  return (
    <aside aria-label="Active Missing Person Alert" className="alertcard">
      <div className="alert-strip">
        <span className="live" aria-hidden="true" />
        <span>Missing person · last seen {alert.lastSeenTimeAgo}</span>
        <span className="alert-strip-actions">
          <button
            type="button"
            className="alert-strip-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize to avoid blocking other emergency aid"
            aria-label="Minimize alert banner"
          >
            <Icon name="minus" />Minimize
          </button>
          <button
            type="button"
            className="alert-strip-btn"
            onClick={() => setIsDismissed(true)}
            title="Dismiss alert"
            aria-label="Dismiss alert banner"
          >
            <Icon name="x" />
          </button>
        </span>
      </div>

      <div className="d-alert">
        <div className="d-alert-photo" aria-hidden="true">
          {alert.photoUrl ? <img src={alert.photoUrl} alt="" /> : <span>{initials(alert.name)}</span>}
        </div>

        <div className="d-alert-info">
          <h2>{alert.name}, {alert.age}</h2>
          <p>Last seen near <b>{alert.lastSeenLocation}</b>. {alert.description}</p>
          <span className="verified"><Icon name="check" />Verified by ComForce</span>
        </div>

        {total > 0 && (
          <div className="d-alert-prog">
            <span>{searched} of {total} sectors searched</span>
            <div className="segs" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <i key={i} className={i < searched ? 'done' : i === searched ? 'on' : undefined} />
              ))}
            </div>
          </div>
        )}

        <div className="d-alert-acts">
          <button type="button" className="btn danger" onClick={onJoinSearch}>
            Join the search
          </button>
          <button type="button" className="btn" onClick={() => setIsMinimized(true)}>
            Minimize for other aid
          </button>
        </div>
      </div>

      <div className="d-alert-why">
        <Icon name="alert" />
        <span>
          <b>Why you&rsquo;re seeing this:</b> ComForce posts verified alerts for missing neighbors nearby. You can join,
          minimize, or dismiss it. All of those are fine.
        </span>
      </div>
    </aside>
  );
}
