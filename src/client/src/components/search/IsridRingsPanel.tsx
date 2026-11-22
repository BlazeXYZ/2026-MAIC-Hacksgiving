import type { ReactElement } from 'react';
import {
  ISRID_CATEGORIES,
  RING_COLORS,
  RING_PERCENTILES,
  type IsridCategory,
  type IsridEnvironment,
} from './isrid';
import './IsridRings.css';

interface IsridRingsPanelProps {
  category: IsridCategory;
  environment: IsridEnvironment;
  onCategoryChange: (id: string) => void;
  onEnvironmentChange: (env: IsridEnvironment) => void;
  onZoomToRings: () => void;
}

const ENVIRONMENTS: IsridEnvironment[] = ['Urban', 'Temperate'];

export default function IsridRingsPanel({
  category,
  environment,
  onCategoryChange,
  onEnvironmentChange,
  onZoomToRings,
}: IsridRingsPanelProps): ReactElement {
  const distances = category.environments[environment];

  return (
    <div className="isrid-panel" aria-labelledby="isrid-panel-heading">
      <div className="isrid-panel-row">
        <strong id="isrid-panel-heading" className="isrid-panel-title">
          Distance rings from last-known point
          <span className="isrid-badge">Informed by ISRID</span>
          {category.placeholder && (
            <span className="isrid-badge isrid-badge--placeholder">Placeholder values, not ISRID data</span>
          )}
        </strong>
        <div className="isrid-panel-controls">
          <label>
            Missing person
            <select value={category.id} onChange={(e) => onCategoryChange(e.target.value)}>
              {ISRID_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.placeholder ? ' (placeholder)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Setting
            <select value={environment} onChange={(e) => onEnvironmentChange(e.target.value as IsridEnvironment)}>
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="isrid-zoom-btn" onClick={onZoomToRings}>
            Zoom to rings
          </button>
        </div>
      </div>

      <ul className="isrid-legend" aria-label="ISRID ring legend">
        {RING_PERCENTILES.map((p) => (
          <li key={p}>
            <span
              className={`isrid-legend-ring ${p === 95 ? 'isrid-legend-ring--dashed' : ''}`}
              style={{ borderColor: RING_COLORS[p] }}
              aria-hidden="true"
            />
            {p}% found within {distances.km[p]} km
          </li>
        ))}
        {distances.n !== null && <li className="isrid-legend-n">n = {distances.n} cases</li>}
      </ul>

      <p className="isrid-caveat" role="note">
        <strong>Caveat:</strong> ISRID data is mostly from wilderness and rural searches. Urban cases, especially
        teens using buses or trains, may not follow these rings. Use them to plan where to start, not to rule
        areas out.
      </p>

      <p className="isrid-source">
        {category.placeholder || !distances.source ? (
          <>
            Source: none. These are placeholder numbers because we could not verify a public ISRID table for this
            category.
          </>
        ) : (
          <>
            Source:{' '}
            <a href={distances.source.url} target="_blank" rel="noreferrer">
              {distances.source.citation}
            </a>{' '}
            ({distances.source.location}).
          </>
        )}
      </p>
    </div>
  );
}
