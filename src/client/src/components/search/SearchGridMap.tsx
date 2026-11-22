import { useEffect, useRef, useState, useMemo } from 'react';
import {
  circle,
  circleMarker,
  latLng,
  latLngBounds,
  layerGroup,
  map as createMap,
  polygon,
  tileLayer,
  type Map as MapInstance,
  type Polygon,
} from 'leaflet';
import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  generateInitialSectors,
  STATUS_COLORS,
  type SearchSector,
  type SectorStatus,
} from './searchGrid';
import {
  combinedDetectionChance,
  formatAge,
  PER_PASS_DETECTION_P,
  recordPass,
  resolveStatus,
  STALE_AFTER_HOURS,
} from './searchCoverage';
import './SearchGridMap.css';
import {
  DEFAULT_ISRID_CATEGORY_ID,
  DEFAULT_ISRID_ENVIRONMENT,
  RING_COLORS,
  RING_PERCENTILES,
  distanceKm,
  getIsridCategory,
  ringForDistance,
  type IsridEnvironment,
} from './isrid';
import IsridRingsPanel from './IsridRingsPanel';

// Demo search case: last-known point (27th & Wisconsin Ave, Milwaukee).
const LAST_KNOWN_POINT: LatLngTuple = [43.0389, -87.948];

// Statuses a coordinator can set directly. Stale is derived from Cleared + elapsed time.
const SETTABLE_STATUSES: SectorStatus[] = ['Unsearched', 'Searching', 'Cleared', 'Lead Found'];
const CLOCK_TICK_MS = 30 * 1000;

const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export default function SearchGridMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const polygonLayersRef = useRef<Map<string, Polygon>>(new Map());
  const groupRef = useRef<ReturnType<typeof layerGroup> | null>(null);
  const hasFittedRef = useRef<boolean>(false);

  const [sectors, setSectors] = useState<SearchSector[]>(() => generateInitialSectors());
  const [selectedId, setSelectedId] = useState<string>('B3');
  const ringGroupRef = useRef<ReturnType<typeof layerGroup> | null>(null);
  const [isridCategoryId, setIsridCategoryId] = useState<string>(DEFAULT_ISRID_CATEGORY_ID);
  const [isridEnvironment, setIsridEnvironment] = useState<IsridEnvironment>(DEFAULT_ISRID_ENVIRONMENT);
  const isridCategory = getIsridCategory(isridCategoryId);
  const isridDistances = isridCategory.environments[isridEnvironment];

  // Re-render periodically so Cleared sectors decay to Stale without a reload.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const displayStatus = (s: SearchSector): SectorStatus => resolveStatus(s.status, s.lastSearchedAt, nowMs);

  // Stats calculation
  const stats = useMemo(() => {
    const counts: Record<SectorStatus, number> = {
      Unsearched: 0,
      Searching: 0,
      Cleared: 0,
      Stale: 0,
      'Lead Found': 0,
    };
    for (const s of sectors) {
      counts[resolveStatus(s.status, s.lastSearchedAt, nowMs)] += 1;
    }
    return counts;
  }, [sectors, nowMs]);

  // Changes only when some sector's displayed status changes (e.g. Cleared -> Stale).
  const statusSignature = sectors.map((s) => resolveStatus(s.status, s.lastSearchedAt, nowMs)).join('|');

  // Selected sector
  const selectedSector = sectors.find((s) => s.id === selectedId) || sectors[0];
  const selectedStatus = displayStatus(selectedSector);
  const selectedChance = combinedDetectionChance(PER_PASS_DETECTION_P, selectedSector.passCount);

  // Initialize Leaflet Map
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = createMap(container, {
      center: [43.0375, -87.9480],
      zoom: 15,
      scrollWheelZoom: false,
      maxZoom: 18,
    });
    mapRef.current = map;

    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const group = layerGroup().addTo(map);
    groupRef.current = group;
    ringGroupRef.current = layerGroup().addTo(map);

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      hasFittedRef.current = false; // a re-mounted map needs its first fit again
    };
  }, []);

  // Reactively render and update grid polygons when sectors or selection changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.clearLayers();
    const layerMap = new Map<string, Polygon>();
    const allPoints = [];

    for (const sector of sectors) {
      allPoints.push(...sector.coordinates);
      const isSelected = sector.id === selectedId;
      const status = resolveStatus(sector.status, sector.lastSearchedAt, nowMs);
      const palette = STATUS_COLORS[status];

      const poly = polygon(sector.coordinates, {
        color: isSelected ? '#0F6B3A' : palette.border,
        weight: isSelected ? 3.5 : 2,
        fillColor: palette.fill,
        fillOpacity: isSelected ? 0.65 : 0.45,
      });

      poly.on('click', () => {
        setSelectedId(sector.id);
      });

      const tooltipText = `<strong>${sector.name}</strong><br/>Status: ${status}<br/>Passes: ${sector.passCount}<br/>Volunteers: ${sector.volunteers.length}`;
      poly.bindTooltip(tooltipText, { sticky: true });

      poly.addTo(group);
      layerMap.set(sector.id, poly);
    }

    polygonLayersRef.current = layerMap;

    // Fit the grid once. Sector coordinates never change, so re-fitting on status changes,
    // selection, or the stale clock would only throw away the user's pan and zoom.
    if (!hasFittedRef.current && allPoints.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(latLngBounds(allPoints), { padding: [20, 20], maxZoom: 15 });
      hasFittedRef.current = true;
    }
    // statusSignature (not nowMs) so the 30s clock tick does not redraw the polygons
    // unless a sector actually changed to Stale.
  }, [sectors, selectedId, statusSignature]);

  // ISRID distance rings around the last-known point (non-interactive so sector clicks pass through)
  useEffect(() => {
    const ringGroup = ringGroupRef.current;
    if (!ringGroup) return;
    ringGroup.clearLayers();
    for (const p of [...RING_PERCENTILES].reverse()) {
      circle(LAST_KNOWN_POINT, {
        radius: isridDistances.km[p] * 1000,
        color: RING_COLORS[p],
        weight: 2,
        dashArray: p === 95 ? '6 6' : undefined,
        fill: false,
        interactive: false,
      }).addTo(ringGroup);
    }
    circleMarker(LAST_KNOWN_POINT, {
      radius: 6,
      color: '#16201B', // --ink
      weight: 2,
      fillColor: '#E4F23A', // --hivis
      fillOpacity: 1,
    })
      .bindTooltip('Last-known point')
      .addTo(ringGroup);
  }, [isridDistances]);

  const handleZoomToRings = () => {
    const map = mapRef.current;
    if (!map) return;
    // toBounds takes the box size (diameter) in meters.
    map.fitBounds(latLng(LAST_KNOWN_POINT).toBounds(isridDistances.km[95] * 2000), { padding: [10, 10] });
  };

  const selectedRing = selectedSector
    ? ringForDistance(distanceKm(LAST_KNOWN_POINT, selectedSector.center), isridDistances)
    : null;

  // Reactive status update handler
  // Marking Cleared records a completed pass: passCount + 1 and the stale timer resets.
  // Marking Unsearched resets the pass history; other statuses keep it.
  const handleUpdateStatus = (sectorId: string, newStatus: SectorStatus) => {
    const now = Date.now();
    setNowMs(now);
    setSectors((prev) =>
      prev.map((s) => {
        if (s.id !== sectorId) return s;
        const base = { ...s, status: newStatus, updatedAt: 'Just now (Simulated)' };
        if (newStatus === 'Cleared') return { ...base, ...recordPass(s.passCount, now) };
        if (newStatus === 'Unsearched') return { ...base, passCount: 0, lastSearchedAt: null };
        return base;
      })
    );
  };

  // Sign up as searcher handler
  const handleSignUpSearcher = (sectorId: string) => {
    setSectors((prev) =>
      prev.map((s) => {
        if (s.id !== sectorId) return s;
        const alreadyIn = s.volunteers.includes('You (Volunteer)');
        const updatedVolunteers = alreadyIn ? s.volunteers : [...s.volunteers, 'You (Volunteer)'];
        const updatedStatus = s.status === 'Unsearched' ? 'Searching' : s.status;
        return {
          ...s,
          volunteers: updatedVolunteers,
          status: updatedStatus,
          updatedAt: 'Just now (Simulated)',
        };
      })
    );
  };

  return (
    <section className="search-grid-wrapper" aria-labelledby="search-grid-heading">
      <div className="search-grid-header">
        <div>
          <h4 id="search-grid-heading">
            Missing Person Search Party Grid (27th &amp; Wisconsin)
            <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--amber-wash, #fef3c7)', color: 'var(--amber-ink, #92400e)' }}>
              Simulated Grid (Demo Mode)
            </span>
          </h4>
          <p>Real-time sector coordination over Milwaukee neighborhood blocks (simulated demonstration data). Tap a sector to update status or join.</p>
        </div>
        <div className="search-grid-stats">
          <span className="search-grid-stat-pill" style={{ background: 'var(--green-wash)', color: 'var(--green-ink)' }}>
            {stats.Cleared} Cleared
          </span>
          <span className="search-grid-stat-pill" style={{ background: 'var(--stale-wash)', color: 'var(--stale-ink)' }}>
            {stats.Stale} Stale
          </span>
          <span className="search-grid-stat-pill" style={{ background: 'var(--amber-wash)', color: 'var(--amber-ink)' }}>
            {stats.Searching} Searching
          </span>
          <span className="search-grid-stat-pill" style={{ background: 'var(--police-wash)', color: 'var(--police)' }}>
            {stats['Lead Found']} Lead Found
          </span>
          <span className="search-grid-stat-pill" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>
            {stats.Unsearched} Unsearched
          </span>
        </div>
      </div>

      {/* Map View */}
      <div className="search-grid-map-container">
        <div
          ref={containerRef}
          className="search-grid-map-canvas"
          role="region"
          aria-label="Interactive missing person search party grid map"
        />
      </div>

      <IsridRingsPanel
        category={isridCategory}
        environment={isridEnvironment}
        onCategoryChange={setIsridCategoryId}
        onEnvironmentChange={setIsridEnvironment}
        onZoomToRings={handleZoomToRings}
      />

      {/* Quick Sector Selector Bar */}
      <div className="search-grid-selector-bar" role="tablist" aria-label="Select search sector">
        {sectors.map((s) => {
          const isSelected = s.id === selectedId;
          const palette = STATUS_COLORS[displayStatus(s)];
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`search-sector-chip ${isSelected ? 'search-sector-chip--selected' : ''}`}
              onClick={() => setSelectedId(s.id)}
            >
              <span
                className="search-sector-indicator"
                style={{ background: palette.fill }}
                aria-hidden="true"
              />
              {s.id}
            </button>
          );
        })}
      </div>

      {/* Selected Sector Detail Panel (Reactive updates) */}
      {selectedSector && (
        <div className="search-sector-panel" aria-labelledby="selected-sector-title">
          <div className="search-sector-panel-content">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong id="selected-sector-title" style={{ fontSize: '1rem', color: 'var(--ink)' }}>
                  {selectedSector.name}
                </strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: STATUS_COLORS[selectedStatus].badgeBg,
                    color: STATUS_COLORS[selectedStatus].text,
                  }}
                >
                  {selectedStatus}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                  Updated {selectedSector.updatedAt}
                </span>
              </div>

              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                ISRID ring ({isridCategory.label}{isridCategory.placeholder ? ', placeholder' : ''}):{' '}
                {selectedRing === null ? 'beyond the 95% ring' : `inside the ${selectedRing}% ring`}
              </p>

              <div className="search-sector-coverage" aria-label="Search coverage">
                <span>
                  <strong>Passes:</strong> {selectedSector.passCount}
                </span>
                <span>
                  <strong>Last cleared:</strong> {formatAge(selectedSector.lastSearchedAt, nowMs)}
                </span>
                <span>
                  <strong>Est. combined detection:</strong> {Math.round(selectedChance * 100)}%
                </span>
              </div>
              <p className="search-sector-assumption">
                Estimate uses 1 &minus; (1 &minus; p)<sup>n</sup> with an assumed per-pass detection chance
                p = {Math.round(PER_PASS_DETECTION_P * 100)}% (placeholder, not measured). Cleared sectors turn
                Stale after {STALE_AFTER_HOURS}h; marking Cleared again adds a pass and resets the timer.
              </p>
              {selectedStatus === 'Stale' && (
                <p className="search-sector-stale-note" role="status">
                  Last pass was over {STALE_AFTER_HOURS}h ago. Re-search this sector and mark it Cleared.
                </p>
              )}

              {selectedSector.notes && (
                <p style={{ margin: '0.35rem 0', fontSize: '0.825rem', color: 'var(--ink-2)' }}>
                  <strong>Notes / Field Report:</strong> {selectedSector.notes}
                </p>
              )}

              <div style={{ marginTop: '0.5rem', fontSize: '0.825rem' }}>
                <strong style={{ color: 'var(--ink-2)' }}>Assigned Searchers ({selectedSector.volunteers.length}):</strong>{' '}
                {selectedSector.volunteers.length === 0 ? (
                  <span style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>None assigned yet</span>
                ) : (
                  selectedSector.volunteers.map((vol, i) => (
                    <span key={i} className="search-volunteer-pill">
                      {vol}
                    </span>
                  ))
                )}
              </div>

              {/* Status Toggle Buttons */}
              <div className="search-sector-status-group">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)' }}>Update Status:</span>
                {SETTABLE_STATUSES.map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    className="search-status-btn"
                    onClick={() => handleUpdateStatus(selectedSector.id, statusOption)}
                    style={{
                      backgroundColor: selectedStatus === statusOption ? STATUS_COLORS[statusOption].badgeBg : 'var(--card)',
                      color: STATUS_COLORS[statusOption].text,
                      borderColor: selectedStatus === statusOption ? STATUS_COLORS[statusOption].border : 'var(--line-2)',
                    }}
                  >
                    {statusOption}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <button
                type="button"
                className="search-signup-btn"
                onClick={() => handleSignUpSearcher(selectedSector.id)}
              >
                + Sign Up for {selectedSector.id}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <ul className="search-grid-legend" aria-label="Sector status legend">
        <li>
          <span className="search-legend-swatch" style={{ background: STATUS_COLORS.Unsearched.fill }} aria-hidden="true" />
          Unsearched (Gray)
        </li>
        <li>
          <span className="search-legend-swatch" style={{ background: STATUS_COLORS.Searching.fill }} aria-hidden="true" />
          Searching (Yellow)
        </li>
        <li>
          <span className="search-legend-swatch" style={{ background: STATUS_COLORS.Cleared.fill }} aria-hidden="true" />
          Cleared (Green)
        </li>
        <li>
          <span className="search-legend-swatch" style={{ background: STATUS_COLORS.Stale.fill }} aria-hidden="true" />
          Stale (Rust, cleared over {STALE_AFTER_HOURS}h ago)
        </li>
        <li>
          <span className="search-legend-swatch" style={{ background: STATUS_COLORS['Lead Found'].fill }} aria-hidden="true" />
          Lead Found (Blue)
        </li>
      </ul>
    </section>
  );
}
