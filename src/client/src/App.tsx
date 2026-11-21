import { useEffect, useState } from 'react';
import CommunityMap from './components/CommunityMap';
import DeliveryCover from './components/DeliveryCover';
import HelpSurvey from './components/HelpSurvey';
import VolunteerTickets from './components/VolunteerTickets';
import SearchGridMap from './components/search/SearchGridMap';
import UrgentAlertBanner from './components/alerts/UrgentAlertBanner';
import CoordinatorMap from './components/coordinator/CoordinatorMap';
import CoordinatorDashboard from './screens/CoordinatorDashboard';

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
  const [activeTab, setActiveTab] = useState<'communities' | 'map' | 'coordinator' | 'coordinator-ops'>('communities');

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
    <div style={{ minHeight: '100vh', fontFamily: 'var(--f)', backgroundColor: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Top Emergency Priority Banner (Issue #45) */}
      <UrgentAlertBanner
        onJoinSearch={() => {
          setSelectedCommunity('missing-persons');
          setActiveTab('communities');
        }}
      />

      {/* Main Header */}
      <header style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--line)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>ComForce MKE Community Hub</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-3)' }}>Connected through Community Task Force MKE &amp; MSOE</p>
        </div>
        <button
          type="button"
          aria-keyshortcuts="Escape"
          className="btn danger sm"
          onClick={() => setQuickExitTriggered(true)}
        >
          Quick Exit
        </button>
      </header>

      <nav aria-label="Main navigation" className="hub-view-nav">
        <button type="button" aria-current={activeTab === 'communities' ? 'page' : undefined} onClick={() => setActiveTab('communities')}>Communities</button>
        <button type="button" aria-current={activeTab === 'map' ? 'page' : undefined} onClick={() => setActiveTab('map')}>Resident Map</button>
        <button type="button" aria-current={activeTab === 'coordinator' ? 'page' : undefined} onClick={() => setActiveTab('coordinator')}>Coordinator Queue</button>
        <button type="button" aria-current={activeTab === 'coordinator-ops' ? 'page' : undefined} onClick={() => setActiveTab('coordinator-ops')}>Coordinator Ops</button>
      </nav>

      {activeTab === 'map' && <CommunityMap />}
      {activeTab === 'coordinator' && <CoordinatorDashboard />}
      {activeTab === 'coordinator-ops' && (
        <main className="hub-page">
          <CoordinatorMap />
        </main>
      )}

      {/* Main Container */}
      <main hidden={activeTab !== 'communities'} style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
        <details className="help-survey-entry">
          <summary>Request help</summary>
          <HelpSurvey />
        </details>
        {/* Community Tabs */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--ink-2)', marginBottom: '0.75rem' }}>Active Initiatives &amp; Communities</h2>
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
                    border: isSelected ? '2px solid var(--green)' : '1px solid var(--line-2)',
                    backgroundColor: isSelected ? 'var(--green-wash)' : 'var(--card)',
                    color: isSelected ? 'var(--green-ink)' : 'var(--ink)',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{c.tag}</div>
                  <div>{c.name}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected Community Details */}
        <div className="volunteer-board-layout">
          {/* Main Card */}
          <div style={{ backgroundColor: 'var(--card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{active.name}</h3>
            <p style={{ color: 'var(--ink-2)', margin: '0 0 1.25rem 0' }}>{active.description}</p>

            {/* Custom initiative tool based on selection */}
            {active.id === 'domestic-safety' && (
              <div style={{ backgroundColor: 'var(--sunk)', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Safe Route Planner</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-2)' }}>
                  If on the MSOE campus, this automatically routes along well-lit paths to MSOE Public Safety at 1025 N Broadway. In the wider city, it guides you to Sojourner Family Peace Center.
                </p>
                <button className="btn primary sm">
                  Calculate Safe Walk Route
                </button>
              </div>
            )}

            {/* Missing Persons Search Party Grid (#46) */}
            {active.id === 'missing-persons' && (
              <SearchGridMap />
            )}

            {active.id === 'food-pantry' && (
              <div style={{ backgroundColor: 'var(--sunk)', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Pantry Stocking &amp; Relief Hub</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-2)' }}>
                  AI recommendations based on neighborhood need: Juneautown pantries report shortages of high-protein canned foods, baby formula, and warm socks.
                </p>
                <button className="btn primary sm">
                  Post Available Pantry Supplies
                </button>
              </div>
            )}
          </div>

          {/* Sidebar: Volunteer Tickets & District Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <VolunteerTickets />

            {/* District Stats */}
            <div style={{ backgroundColor: 'var(--card)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>District Overview</h4>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
