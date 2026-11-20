import { useEffect, useState } from 'react';
import CommunityMap from './components/CommunityMap';
import DeliveryCover from './components/DeliveryCover';
import HelpSurvey from './components/HelpSurvey';
import VolunteerTickets from './components/VolunteerTickets';

interface Community {
  id: string;
  name: string;
  tag: string;
  description: string;
  members: number;
  openTickets: number;
}

const COMMUNITIES: Community[] = [
  {
    id: 'domestic-safety',
    name: 'Domestic Abuse Support',
    tag: 'Crisis Support',
    description: 'Confidential safety planning, rapid safe routing, and discreet emergency contact.',
    members: 128,
    openTickets: 4,
  },
  {
    id: 'missing-persons',
    name: 'Missing Persons Search Network',
    tag: 'Emergency Response',
    description: 'Coordinate volunteer search parties, share verified sighting tips, and map cleared search sectors.',
    members: 310,
    openTickets: 1,
  },
  {
    id: 'food-pantry',
    name: 'Food Pantry & Mutual Aid',
    tag: 'Community Relief',
    description: 'Find open food pantries, post surplus groceries, and get AI recommendations on high-need items.',
    members: 245,
    openTickets: 6,
  },
];

export default function App() {
  const [selectedCommunity, setSelectedCommunity] = useState<string>('domestic-safety');
  const [quickExitTriggered, setQuickExitTriggered] = useState<boolean>(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (quickExitTriggered) return;

    function handleQuickExit(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault();
        setQuickExitTriggered(true);
      }
    }

    window.addEventListener('keydown', handleQuickExit, true);
    return () => window.removeEventListener('keydown', handleQuickExit, true);
  }, [quickExitTriggered]);

  if (quickExitTriggered) {
    return <DeliveryCover onReturn={() => setQuickExitTriggered(false)} />;
  }

  const active = COMMUNITIES.find((c) => c.id === selectedCommunity) || COMMUNITIES[0];

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      {/* Top Emergency Priority Banner */}
      <div style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>URGENT ALERT:</strong> Active Missing Person Search near 27th & Wisconsin Ave. Volunteer search parties are currently forming.
        </div>
        <button
          onClick={() => { setSelectedCommunity('missing-persons'); setShowMap(false); }}
          style={{ backgroundColor: '#ffffff', color: '#dc2626', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          View Search Grid
        </button>
      </div>

      {/* Main Header */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>ComForce MKE Community Hub</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Connected through Community Task Force MKE & MSOE</p>
        </div>
        <button
          type="button"
          aria-keyshortcuts="Escape"
          onClick={() => setQuickExitTriggered(true)}
          style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Quick Exit
        </button>
      </header>

      <nav aria-label="Main navigation" className="hub-view-nav">
        <button type="button" aria-current={!showMap ? 'page' : undefined} onClick={() => setShowMap(false)}>Communities</button>
        <button type="button" aria-current={showMap ? 'page' : undefined} onClick={() => setShowMap(true)}>Map</button>
      </nav>

      {showMap && <CommunityMap />}

      {/* Main Container */}
      <main hidden={showMap} style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
        <details className="help-survey-entry">
          <summary>Request help</summary>
          <HelpSurvey />
        </details>
        {/* Community Tabs */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#475569', marginBottom: '0.75rem' }}>Active Initiatives & Communities</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {COMMUNITIES.map((c) => {
              const isSelected = c.id === selectedCommunity;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCommunity(c.id)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1e40af' : '#1e293b',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>{c.tag}</div>
                  <div>{c.name}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected Community Details */}
        <div className="volunteer-board-layout">
          {/* Main Card */}
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{active.name}</h3>
            <p style={{ color: '#475569', margin: '0 0 1.25rem 0' }}>{active.description}</p>

            {/* Custom initiative tool based on selection */}
            {active.id === 'domestic-safety' && (
              <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Safe Route Planner</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569' }}>
                  If on the MSOE campus, this automatically routes along well-lit paths to MSOE Public Safety at 1025 N Broadway. In the wider city, it guides you to Sojourner Family Peace Center.
                </p>
                <button style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                  Calculate Safe Walk Route
                </button>
              </div>
            )}

            {active.id === 'missing-persons' && (
              <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Volunteer Search Party Grid</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569' }}>
                  Coordinate volunteer sectors in real time. Click a sector to view volunteer status or mark as searched.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', margin: '1rem 0' }}>
                  {['Sector A (Active)', 'Sector B (Searching)', 'Sector C (Cleared)', 'Sector D (Pending)'].map((sec, i) => (
                    <div key={i} style={{ padding: '0.75rem', backgroundColor: i === 2 ? '#dcfce7' : '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}>
                      {sec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.id === 'food-pantry' && (
              <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Pantry Stocking & Relief Hub</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569' }}>
                  AI recommendations based on neighborhood need: Juneautown pantries report shortages of high-protein canned foods, baby formula, and warm socks.
                </p>
                <button style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                  Post Available Pantry Supplies
                </button>
              </div>
            )}
          </div>

          {/* Sidebar: Volunteer Tickets & District Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <VolunteerTickets />

            {/* District Stats */}
            <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>District Overview</h4>
              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Juneautown / Campus:</span>
                  <strong>5 active calls</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Third Ward:</span>
                  <strong>3 active calls</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Near West Side:</span>
                  <strong>12 active calls</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
