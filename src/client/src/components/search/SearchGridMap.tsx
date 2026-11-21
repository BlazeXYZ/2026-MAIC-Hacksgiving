import { useEffect, useRef, useState, useMemo } from 'react';
import {
  latLngBounds,
  layerGroup,
  map as createMap,
  polygon,
  tileLayer,
  type Map as MapInstance,
  type Polygon,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  generateInitialSectors,
  STATUS_COLORS,
  type SearchSector,
  type SectorStatus,
} from './searchGrid';
import './SearchGridMap.css';

const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export default function SearchGridMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const polygonLayersRef = useRef<Map<string, Polygon>>(new Map());
  const groupRef = useRef<ReturnType<typeof layerGroup> | null>(null);

  const [sectors, setSectors] = useState<SearchSector[]>(() => generateInitialSectors());
  const [selectedId, setSelectedId] = useState<string>('B3');

  // Stats calculation
  const stats = useMemo(() => {
    const counts: Record<SectorStatus, number> = {
      Unsearched: 0,
      Searching: 0,
      Cleared: 0,
      'Lead Found': 0,
    };
    for (const s of sectors) {
      counts[s.status] += 1;
    }
    return counts;
  }, [sectors]);

  // Selected sector
  const selectedSector = sectors.find((s) => s.id === selectedId) || sectors[0];

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

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
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
      const palette = STATUS_COLORS[sector.status];

      const poly = polygon(sector.coordinates, {
        color: isSelected ? '#1e40af' : palette.border,
        weight: isSelected ? 3.5 : 2,
        fillColor: palette.fill,
        fillOpacity: isSelected ? 0.65 : 0.45,
      });

      poly.on('click', () => {
        setSelectedId(sector.id);
      });

      const tooltipText = `<strong>${sector.name}</strong><br/>Status: ${sector.status}<br/>Volunteers: ${sector.volunteers.length}`;
      poly.bindTooltip(tooltipText, { sticky: true });

      poly.addTo(group);
      layerMap.set(sector.id, poly);
    }

    polygonLayersRef.current = layerMap;

    if (allPoints.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(latLngBounds(allPoints), { padding: [20, 20], maxZoom: 15 });
    }
  }, [sectors, selectedId]);

  // Reactive status update handler
  const handleUpdateStatus = (sectorId: string, newStatus: SectorStatus) => {
    setSectors((prev) =>
      prev.map((s) =>
        s.id === sectorId
          ? { ...s, status: newStatus, updatedAt: 'Just now' }
          : s
      )
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
          updatedAt: 'Just now',
        };
      })
    );
  };

  return (
    <section className="search-grid-wrapper" aria-labelledby="search-grid-heading">
      <div className="search-grid-header">
        <div>
          <h4 id="search-grid-heading">Missing Person Search Party Grid (27th &amp; Wisconsin)</h4>
          <p>Real-time sector coordination over Milwaukee neighborhood blocks. Tap a sector to update status or join.</p>
        </div>
        <div className="search-grid-stats">
          <span className="search-grid-stat-pill" style={{ background: '#dcfce7', color: '#166534' }}>
            {stats.Cleared} Cleared
          </span>
          <span className="search-grid-stat-pill" style={{ background: '#fef9c3', color: '#854d0e' }}>
            {stats.Searching} Searching
          </span>
          <span className="search-grid-stat-pill" style={{ background: '#dbeafe', color: '#1e40af' }}>
            {stats['Lead Found']} Lead Found
          </span>
          <span className="search-grid-stat-pill" style={{ background: '#f1f5f9', color: '#475569' }}>
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

      {/* Quick Sector Selector Bar */}
      <div className="search-grid-selector-bar" role="tablist" aria-label="Select search sector">
        {sectors.map((s) => {
          const isSelected = s.id === selectedId;
          const palette = STATUS_COLORS[s.status];
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
                <strong id="selected-sector-title" style={{ fontSize: '1rem', color: '#0f172a' }}>
                  {selectedSector.name}
                </strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: STATUS_COLORS[selectedSector.status].badgeBg,
                    color: STATUS_COLORS[selectedSector.status].text,
                  }}
                >
                  {selectedSector.status}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Updated {selectedSector.updatedAt}
                </span>
              </div>

              {selectedSector.notes && (
                <p style={{ margin: '0.35rem 0', fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Notes / Field Report:</strong> {selectedSector.notes}
                </p>
              )}

              <div style={{ marginTop: '0.5rem', fontSize: '0.825rem' }}>
                <strong style={{ color: '#475569' }}>Assigned Searchers ({selectedSector.volunteers.length}):</strong>{' '}
                {selectedSector.volunteers.length === 0 ? (
                  <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>None assigned yet</span>
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
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Update Status:</span>
                {(['Unsearched', 'Searching', 'Cleared', 'Lead Found'] as SectorStatus[]).map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    className="search-status-btn"
                    onClick={() => handleUpdateStatus(selectedSector.id, statusOption)}
                    style={{
                      backgroundColor: selectedSector.status === statusOption ? STATUS_COLORS[statusOption].badgeBg : '#ffffff',
                      color: STATUS_COLORS[statusOption].text,
                      borderColor: selectedSector.status === statusOption ? STATUS_COLORS[statusOption].border : '#cbd5e1',
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
          <span className="search-legend-swatch" style={{ background: STATUS_COLORS['Lead Found'].fill }} aria-hidden="true" />
          Lead Found (Blue)
        </li>
      </ul>
    </section>
  );
}
