import { useState } from 'react';
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
}

export const ACTIVE_MISSING_PERSON_ALERT: MissingPersonAlert = {
  id: 'mp-mke-2026',
  name: 'Jordan Walker',
  age: 19,
  lastSeenLocation: '27th & W Wisconsin Ave',
  lastSeenTimeAgo: '45 mins ago',
  description: 'Wearing navy MSOE windbreaker, gray beanie, and tan work boots. Search parties are deploying along grid sectors A–D.',
  active: true,
};

interface UrgentAlertBannerProps {
  alert?: MissingPersonAlert;
  onJoinSearch: () => void;
}

export default function UrgentAlertBanner({
  alert = ACTIVE_MISSING_PERSON_ALERT,
  onJoinSearch,
}: UrgentAlertBannerProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If no active search is flagged or user explicitly dismissed this session, don't render
  if (!alert.active || isDismissed) {
    return null;
  }

  // Minimized mode: discreet header bar that doesn't block domestic crisis or food seekers
  if (isMinimized) {
    return (
      <aside aria-label="Minimized Emergency Alert" className="urgent-alert-container">
        <div className="urgent-alert-minimized">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span aria-hidden="true">⚠️</span>
            <strong>Urgent Alert Active:</strong> Missing person search near {alert.lastSeenLocation}.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className="urgent-alert-expand-btn"
              onClick={() => setIsMinimized(false)}
              aria-label="Expand emergency missing person alert"
            >
              Expand Alert
            </button>
            <button
              type="button"
              className="urgent-alert-expand-btn"
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss alert"
            >
              &times;
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Expanded prominent alert banner
  return (
    <aside aria-label="Active Missing Person Alert" className="urgent-alert-container">
      <div className="urgent-alert-banner">
        {/* Top Warning Strip */}
        <div className="urgent-alert-strip">
          <div className="urgent-alert-badge">
            <span className="urgent-alert-pulse" aria-hidden="true" />
            <span>URGENT ALERT: MISSING PERSON</span>
          </div>
          <div className="urgent-alert-meta">
            Active Volunteer Search Party · Last seen {alert.lastSeenTimeAgo}
          </div>
          <div className="urgent-alert-strip-actions">
            <button
              type="button"
              className="urgent-alert-strip-btn"
              onClick={() => setIsMinimized(true)}
              title="Minimize to avoid blocking other emergency aid"
              aria-label="Minimize alert banner"
            >
              _ Minimize
            </button>
            <button
              type="button"
              className="urgent-alert-strip-btn"
              onClick={() => setIsDismissed(true)}
              title="Dismiss alert"
              aria-label="Dismiss alert banner"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Main Banner Content */}
        <div className="urgent-alert-body">
          {/* Photo / Thumbnail Placeholder */}
          <div className="urgent-alert-thumbnail" aria-hidden="true">
            {alert.photoUrl ? (
              <img src={alert.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>JW</span>
            )}
          </div>

          {/* Details */}
          <div className="urgent-alert-info">
            <h3>
              {alert.name} <span>(Age {alert.age})</span>
            </h3>
            <div className="urgent-alert-location">
              📍 Last seen near <strong>{alert.lastSeenLocation}</strong>
            </div>
            <p className="urgent-alert-desc">
              {alert.description}
            </p>
          </div>

          {/* Actions */}
          <div className="urgent-alert-actions">
            <button
              type="button"
              className="urgent-alert-cta"
              onClick={onJoinSearch}
            >
              Join Search Party &rarr;
            </button>
            <button
              type="button"
              className="urgent-alert-snooze-btn"
              onClick={() => setIsMinimized(true)}
            >
              Minimize for other aid
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
