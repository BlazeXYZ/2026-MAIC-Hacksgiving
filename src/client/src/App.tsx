import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import CommunityMap from './components/CommunityMap';
import DeliveryCover from './components/DeliveryCover';
import HelpSurvey from './components/HelpSurvey';
import VolunteerTickets from './components/VolunteerTickets';
import SearchGridMap from './components/search/SearchGridMap';
import UrgentAlertBanner from './components/alerts/UrgentAlertBanner';
import CoordinatorMap from './components/coordinator/CoordinatorMap';
import CoordinatorSignIn from './components/coordinator/CoordinatorSignIn';
import CoordinatorDashboard from './screens/CoordinatorDashboard';
import InventoryHub from './components/inventory/InventoryHub';
import InventoryReview from './components/inventory/review/InventoryReview';
import { COMFORCE_HOTLINE } from './components/shell/EmergencyBar';
import { Icon, LogoMark } from './components/ui/Icon';
import type { IconName } from './components/ui/Icon';

type HubId = 'domestic-safety' | 'missing-persons' | 'food-pantry';
type Tab = 'home' | 'map' | 'inventory' | 'coordinator' | 'coordinator-ops' | 'inventory-review' | 'staff-sign-in';

interface Community {
  id: HubId;
  name: string;
  tag: string;
  description: string;
  members: number;
  openTickets: number;
  icon: IconName;
  swatch: '' | 'red' | 'amber';
}

const COMMUNITIES: Community[] = [
  {
    id: 'domestic-safety',
    name: 'Domestic Abuse Support',
    tag: 'Crisis Support',
    description: 'Confidential safety planning, rapid safe routing, and discreet emergency contact.',
    members: 128,
    openTickets: 4,
    icon: 'shield',
    swatch: '',
  },
  {
    id: 'missing-persons',
    name: 'Missing Persons Search Network',
    tag: 'Emergency Response',
    description: 'Coordinate volunteer search parties, share verified sighting tips, and map cleared search sectors.',
    members: 310,
    openTickets: 1,
    icon: 'search',
    swatch: 'red',
  },
  {
    id: 'food-pantry',
    name: 'Food Pantry & Mutual Aid',
    tag: 'Community Relief',
    description: 'Find open food pantries, post surplus groceries, and get AI recommendations on high-need items.',
    members: 245,
    openTickets: 6,
    icon: 'food',
    swatch: 'amber',
  },
];

const DISTRICTS: { name: string; calls: number; short: boolean }[] = [
  { name: 'Near West Side', calls: 12, short: true },
  { name: 'Juneautown / Campus', calls: 5, short: false },
  { name: 'Historic Third Ward', calls: 3, short: false },
];

const STAFF_TABS: ReadonlySet<Tab> = new Set(['coordinator', 'coordinator-ops', 'inventory-review']);

function partOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default function App(): ReactElement {
  const [selectedCommunity, setSelectedCommunity] = useState<HubId>('domestic-safety');
  const [quickExitTriggered, setQuickExitTriggered] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [askingForHelp, setAskingForHelp] = useState<boolean>(false);
  const [inventoryAction, setInventoryAction] = useState<'request' | 'give' | 'remove' | null>(null);
  // Held in memory only: a reload or Quick Exit signs staff out.
  const [coordinatorKey, setCoordinatorKey] = useState<string | null>(null);
  const surveyRef = useRef<HTMLElement>(null);
  const hubRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!quickExitTriggered) return;
    setCoordinatorKey(null);
    setActiveTab('home');
  }, [quickExitTriggered]);

  useEffect(() => {
    if (quickExitTriggered) return;

    function handleQuickExit(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault();
        setQuickExitTriggered(true);
      }
    }

    window.addEventListener('keydown', handleQuickExit, true);
    return () => window.removeEventListener('keydown', handleQuickExit, true);
  }, [quickExitTriggered]);

  useEffect(() => {
    if (askingForHelp) surveyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [askingForHelp]);

  if (quickExitTriggered) {
    return <DeliveryCover onReturn={() => setQuickExitTriggered(false)} />;
  }

  const active = COMMUNITIES.find((c) => c.id === selectedCommunity) ?? COMMUNITIES[0];
  const isStaff = coordinatorKey !== null && STAFF_TABS.has(activeTab);
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

  function go(tab: Tab): void {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }

  function openHub(id: HubId): void {
    setSelectedCommunity(id);
    setActiveTab('home');
    requestAnimationFrame(() => hubRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function navButton(tab: Tab, label: string): ReactElement {
    return (
      <button type="button" aria-current={activeTab === tab ? 'page' : undefined} onClick={() => go(tab)}>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="app">
      <header className={isStaff ? 'dnav staff' : 'dnav'}>
        <button type="button" className="logo" onClick={() => go(isStaff ? 'coordinator' : 'home')} aria-label="ComForce MKE home">
          <LogoMark />
          <b>ComForce <span>MKE</span></b>
        </button>
        {isStaff && <span className="ws">Coordinator</span>}
        <nav aria-label="Main navigation">
          {isStaff ? (
            <>
              {navButton('coordinator', 'Tonight')}
              {navButton('coordinator-ops', 'Ops map')}
              {navButton('inventory-review', 'Inventory')}
              <button type="button" className="switch" onClick={() => { setCoordinatorKey(null); go('home'); }}>Sign out</button>
              <button type="button" className="switch" onClick={() => go('home')}>Resident view</button>
            </>
          ) : (
            <>
              {navButton('home', 'Home')}
              {navButton('map', 'Map')}
              {navButton('inventory', 'Inventory')}
              {coordinatorKey ? (
                <>
                  <button type="button" className="switch" onClick={() => go('coordinator')}>Coordinator</button>
                  <button type="button" className="switch" onClick={() => { setCoordinatorKey(null); go('home'); }}>Sign out</button>
                </>
              ) : (
                <button type="button" className="switch" onClick={() => go('staff-sign-in')}>Staff sign in</button>
              )}
            </>
          )}
        </nav>
        <div className="dtools">
          <button
            type="button"
            className="esc"
            aria-keyshortcuts="Escape"
            onClick={() => setQuickExitTriggered(true)}
          >
            <kbd>esc</kbd>Quick exit
          </button>
        </div>
      </header>

      <main className="dpage">
        {!isStaff && <UrgentAlertBanner onJoinSearch={() => openHub('missing-persons')} />}

        {activeTab === 'map' && <CommunityMap />}

        {activeTab === 'inventory' && (
          <InventoryHub initialAction={inventoryAction} onActionHandled={() => setInventoryAction(null)} />
        )}

        {(activeTab === 'staff-sign-in' || (STAFF_TABS.has(activeTab) && !coordinatorKey)) && (
          <CoordinatorSignIn onSignIn={(key) => { setCoordinatorKey(key); go(activeTab === 'staff-sign-in' ? 'coordinator' : activeTab); }} />
        )}

        {activeTab === 'inventory-review' && coordinatorKey && <InventoryReview initialKey={coordinatorKey} />}

        {activeTab === 'coordinator' && coordinatorKey && (
          <CoordinatorDashboard accessKey={coordinatorKey} />
        )}

        {activeTab === 'coordinator-ops' && coordinatorKey && (
          <CoordinatorMap accessKey={coordinatorKey} />
        )}

        <div hidden={activeTab !== 'home'}>
          <section className="greet" aria-labelledby="greet-title">
            <div className="kicker">Milwaukee · {weekday} {partOfDay(now)}</div>
            <h1 id="greet-title">Welcome. <em>Glad you&rsquo;re here.</em></h1>
            <p>
              ComForce MKE connects Milwaukee neighbors with help, safe places, and each other. Here&rsquo;s what&rsquo;s
              happening near you.
            </p>
          </section>

          {askingForHelp && (
            <section className="mod" ref={surveyRef} aria-label="Ask for help" style={{ marginBottom: 24, scrollMarginTop: 96 }}>
              <div className="mod-h">
                <h2>Ask for help</h2>
                <button type="button" className="more" onClick={() => setAskingForHelp(false)}>Close</button>
              </div>
              <div className="mod-b">
                <HelpSurvey />
              </div>
            </section>
          )}

          <div className="g12 stretch">
            <section className="mod c7" ref={hubRef} aria-labelledby="hubs-title" style={{ scrollMarginTop: 96 }}>
              <div className="mod-h">
                <h2 id="hubs-title">Your hubs</h2>
                <span className="count">{COMMUNITIES.length} active</span>
              </div>
              <p className="mod-sub">Each ComForce program has a hub with its own tools. Pick one to see what it&rsquo;s doing.</p>
              <div className="hubs">
                {COMMUNITIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={c.id === selectedCommunity}
                    onClick={() => setSelectedCommunity(c.id)}
                  >
                    <span className={`sw ${c.swatch}`}><Icon name={c.icon} /></span>
                    <b>{c.name}</b>
                    <small>{c.members} members · {c.openTickets} open</small>
                  </button>
                ))}
              </div>
              <p className="hub-desc">{active.description}</p>

              {active.id === 'domestic-safety' && (
                <div className="hubtool">
                  <h3>Safe route planner</h3>
                  <p>
                    On the MSOE campus, this routes along well-lit paths to MSOE Public Safety at 1025 N Broadway. In the
                    wider city, it guides you to Sojourner Family Peace Center.
                  </p>
                  <button type="button" className="btn primary sm" onClick={() => go('map')}>
                    <Icon name="nav" />Plan a safe walk
                  </button>
                </div>
              )}

              {active.id === 'missing-persons' && (
                <div className="hub-body">
                  <SearchGridMap />
                </div>
              )}

              {active.id === 'food-pantry' && (
                <div className="hubtool">
                  <h3>Pantry stocking &amp; relief</h3>
                  <p className="why" style={{ fontSize: 15 }}>
                    <Icon name="spark" />
                    Juneautown pantries report shortages of high-protein canned foods, baby formula, and warm socks.
                  </p>
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={() => {
                      setInventoryAction('give');
                      go('inventory');
                    }}
                  >
                    <Icon name="plus" />Post available supplies
                  </button>
                </div>
              )}
            </section>

            <section className="mod c5" aria-labelledby="needs-title">
              <div className="mod-h">
                <h2 id="needs-title">What do you need?</h2>
              </div>
              <div className="needs">
                <button type="button" className="primary" onClick={() => setAskingForHelp(true)}>
                  <span className="sq"><Icon name="plus" /></span>
                  <span><b>Ask for help</b><small>Food, a ride, a check-in</small></span>
                  <Icon name="chev" className="ic chev" />
                </button>
                <button type="button" onClick={() => go('map')}>
                  <span className="sq"><Icon name="shield" /></span>
                  <span><b>Get somewhere safe</b><small>Verified safe places and lit walking routes</small></span>
                  <Icon name="chev" className="ic chev" />
                </button>
                <button type="button" onClick={() => openHub('food-pantry')}>
                  <span className="sq"><Icon name="food" /></span>
                  <span><b>Find food tonight</b><small>Pantries and mutual aid near you</small></span>
                  <Icon name="chev" className="ic chev" />
                </button>
                <button type="button" onClick={() => openHub('missing-persons')}>
                  <span className="sq"><Icon name="search" /></span>
                  <span><b>Join a search</b><small>Help cover a sector with other neighbors</small></span>
                  <Icon name="chev" className="ic chev" />
                </button>
              </div>
              <div className="sos">
                <Icon name="phone" />
                <span>
                  In danger? Call <a href="tel:911">911</a> · 24/7 line <a href={COMFORCE_HOTLINE.tel}>{COMFORCE_HOTLINE.display}</a>
                </span>
              </div>
            </section>
          </div>

          <div className="g12">
            <div className="c7">
              <VolunteerTickets />
            </div>
            <section className="mod c5" aria-labelledby="districts-title">
              <div className="mod-h">
                <h2 id="districts-title">Where help is short</h2>
                <button type="button" className="more" onClick={() => go('coordinator')}>Coordinator view</button>
              </div>
              <div className="mod-b dist-rows">
                {DISTRICTS.map((d) => (
                  <div key={d.name}>
                    <span>{d.name}</span>
                    <b className={d.short ? 'short' : undefined}>{d.calls} active calls</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="dfoot">
        <span><b>ComForce MKE</b> · Community Task Force MKE · Milwaukee, WI</span>
        <span><b>Made in Milwaukee</b> · prototype, sample data</span>
      </footer>
    </div>
  );
}
