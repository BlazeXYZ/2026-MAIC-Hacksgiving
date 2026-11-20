import { AlertCircle, ArrowRight, ChevronRight, HeartHandshake, LayoutGrid, LogOut, MapPin, Plus, Search, Shield, Utensils } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CommunityMap from './components/CommunityMap';
import HelpSurvey from './components/HelpSurvey';
import VolunteerTickets from './components/VolunteerTickets';
import './App.css';

const COMMUNITIES = [
  {
    id: 'domestic-safety',
    name: 'Domestic Abuse Support',
    tag: 'Crisis support',
    description: 'Explore a sample safety planning and community resource hub.',
    icon: Shield,
  },
  {
    id: 'missing-persons',
    name: 'Missing Persons Search Network',
    tag: 'Search and response',
    description: 'See how volunteer teams could track which areas have been searched.',
    icon: Search,
  },
  {
    id: 'food-pantry',
    name: 'Food Pantry & Mutual Aid',
    tag: 'Food and supplies',
    description: 'Explore sample food pickup and donation locations.',
    icon: Utensils,
  },
] as const;

const NAV_ITEMS = [
  { id: 'communities', label: 'Communities', icon: LayoutGrid },
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'survey', label: 'Request help', icon: HeartHandshake },
] as const;

const SEARCH_SECTORS = [
  { name: 'Sector A', status: 'Active' },
  { name: 'Sector B', status: 'Searching' },
  { name: 'Sector C', status: 'Cleared' },
  { name: 'Sector D', status: 'Pending' },
];

const DISTRICTS = [
  { name: 'Juneautown / Campus', calls: 5 },
  { name: 'Third Ward', calls: 3 },
  { name: 'Near West Side', calls: 12 },
];

const BASEMAP_PREVIEW = new URL('./assets/community-basemap.png', import.meta.url).href;

type View = (typeof NAV_ITEMS)[number]['id'];
type CommunityId = (typeof COMMUNITIES)[number]['id'];

export default function App() {
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityId>('domestic-safety');
  const [quickExitTriggered, setQuickExitTriggered] = useState(false);
  const [view, setView] = useState<View>('communities');
  const exitHeading = useRef<HTMLHeadingElement>(null);
  const searchGridHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (quickExitTriggered) {
      exitHeading.current?.focus();
      return;
    }

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
    return (
      <main className="transit-screen">
        <header className="transit-header">
          <div className="transit-content">
            <p>Milwaukee Transit Schedule</p>
            <h2 ref={exitHeading} tabIndex={-1}>Route 30</h2>
          </div>
        </header>
        <div className="transit-content transit-body">
          <section aria-label="Next arrival" className="transit-arrival">
            <span>Next arrival</span>
            <strong>6 min</strong>
            <p>N Broadway &amp; E State St</p>
          </section>
          <button type="button" onClick={() => setQuickExitTriggered(false)}>
            Return to Portal
          </button>
        </div>
      </main>
    );
  }

  const active = COMMUNITIES.find((community) => community.id === selectedCommunity) ?? COMMUNITIES[0];

  function openView(nextView: View) {
    setView(nextView);
    window.scrollTo(0, 0);
  }

  function openSearchGrid() {
    setSelectedCommunity('missing-persons');
    setView('communities');
    requestAnimationFrame(() => searchGridHeading.current?.focus());
  }

  return (
    <div className="hub-app">
      <header className="hub-header">
        <div className="hub-header-inner">
          <div className="hub-brand">
            <span className="hub-brand-mark" aria-hidden="true"><Plus size={22} strokeWidth={3} /></span>
            <h1>ComForce <span>MKE</span><small>Community Hub</small></h1>
          </div>
          <nav aria-label="Main navigation" className="hub-view-nav">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={view === id ? 'page' : undefined}
                onClick={() => openView(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="hub-button hub-button--danger hub-exit"
            aria-keyshortcuts="Escape"
            onClick={() => setQuickExitTriggered(true)}
          >
            <LogOut size={16} aria-hidden="true" />
            Quick Exit
            <kbd aria-hidden="true">Esc</kbd>
          </button>
        </div>
      </header>

      <aside className="hub-alert-wrap hub-width" aria-label="Demo alert">
        <div className="hub-alert">
          <AlertCircle size={21} aria-hidden="true" />
          <p><strong>Demo alert</strong><span>Sample missing-person search near 27th &amp; Wisconsin Ave.</span></p>
          <button type="button" className="hub-button hub-button--alert" onClick={openSearchGrid}>
            View Search Grid <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {view === 'map' && <CommunityMap />}
      {view === 'survey' && <HelpSurvey />}

      <main className="hub-page hub-home" hidden={view !== 'communities'}>
        <section className="hub-hero" aria-labelledby="hub-hero-title">
          <div className="hub-hero-copy">
            <h2 id="hub-hero-title">Find help in Milwaukee<span>.</span></h2>
            <p>Food, a ride, a warm place, or someone to talk to.</p>
            <div className="hub-hero-actions">
              <button type="button" className="hub-button hub-button--highlight" onClick={() => openView('survey')}>
                Start a help request <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="hub-button hub-button--on-dark" onClick={() => openView('map')}>
                <MapPin size={17} aria-hidden="true" /> Explore the map
              </button>
            </div>
          </div>
          <div className="hub-hero-map">
            <img src={BASEMAP_PREVIEW} alt="" width={1250} height={710} />
            <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
          </div>
        </section>

        <div className="hub-overview">
          <VolunteerTickets />

          <div className="hub-overview-side">
            <section className="hub-panel hub-communities" aria-labelledby="communities-title">
              <h2 id="communities-title">Community hubs</h2>
              <ul className="hub-community-list">
                {COMMUNITIES.map(({ id, name, tag, icon: Icon }) => (
                  <li key={id}>
                    <button type="button" aria-pressed={id === active.id} onClick={() => setSelectedCommunity(id)}>
                      <span className="hub-community-icon"><Icon size={19} aria-hidden="true" /></span>
                      <span><strong>{name}</strong><small>{tag}</small></span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="hub-community-detail">
                <p>{active.description}</p>
                {active.id === 'domestic-safety' && (
                  <>
                    <h3>Safe Route Planner</h3>
                    <button type="button" className="hub-button hub-button--secondary" onClick={() => openView('map')}>
                      Explore sample locations
                    </button>
                  </>
                )}
                {active.id === 'missing-persons' && (
                  <>
                    <h3 ref={searchGridHeading} tabIndex={-1}>Volunteer Search Party Grid</h3>
                    <ul className="hub-search-sectors" aria-label="Sample search sectors">
                      {SEARCH_SECTORS.map(({ name, status }) => (
                        <li key={name} data-status={status}><strong>{name}</strong><span>{status}</span></li>
                      ))}
                    </ul>
                  </>
                )}
                {active.id === 'food-pantry' && (
                  <>
                    <h3>Pantry Stocking &amp; Relief Hub</h3>
                    <button type="button" className="hub-button hub-button--secondary" onClick={() => openView('map')}>
                      View pantry locations
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="hub-panel hub-districts" aria-labelledby="districts-title">
              <h2 id="districts-title">District overview</h2>
              <dl>
                {DISTRICTS.map(({ name, calls }) => (
                  <div key={name}><dt>{name}</dt><dd>{calls} active calls</dd></div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </main>

      <footer className="hub-footer hub-width">
        <span>Community Task Force MKE &amp; MSOE</span>
        <span>Demo preview · sample data</span>
      </footer>
    </div>
  );
}
