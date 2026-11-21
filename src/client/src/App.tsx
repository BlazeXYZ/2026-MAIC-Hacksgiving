import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import CommunityMap from './components/CommunityMap';
import HelpSurvey from './components/HelpSurvey';
import VolunteerTickets from './components/VolunteerTickets';
import SearchGridMap from './components/search/SearchGridMap';
import UrgentAlertBanner, { type MissingPersonAlert } from './components/alerts/UrgentAlertBanner';
import CoordinatorMap from './components/coordinator/CoordinatorMap';
import CoordinatorSignIn from './components/coordinator/CoordinatorSignIn';
import CoordinatorDashboard from './screens/CoordinatorDashboard';
import InventoryHub from './components/inventory/InventoryHub';
import InventoryReview from './components/inventory/review/InventoryReview';
import HubForum from './components/forums/HubForum';
import ForumReview from './components/forums/ForumReview';
import { COMFORCE_HOTLINE } from './components/shell/EmergencyBar';
import { Icon, LogoMark } from './components/ui/Icon';
import type { IconName } from './components/ui/Icon';

type HubId = 'domestic-safety' | 'missing-persons' | 'food-pantry';
type Tab =
  | 'home'
  | 'map'
  | 'help'
  | 'requests'
  | 'me'
  | 'inventory'
  | 'coordinator'
  | 'coordinator-ops'
  | 'inventory-review'
  | 'forum-review'
  | 'staff-sign-in';
type HubView = 'threads' | 'tool';

interface Community {
  id: HubId;
  name: string;
  tag: string;
  description: string;
  members: number;
  openTickets: number;
  icon: IconName;
  swatch: '' | 'red' | 'amber';
  /** Label for the hub's own tool, shown as a tab next to Threads. */
  tool: string;
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
    tool: 'Safe route',
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
    tool: 'Search grid',
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
    tool: 'Pantry stocking',
  },
];

const DISTRICTS: { name: string; calls: number; short: boolean }[] = [
  { name: 'Near West Side', calls: 12, short: true },
  { name: 'Juneautown / Campus', calls: 5, short: false },
  { name: 'Historic Third Ward', calls: 3, short: false },
];

const STAFF_TABS: ReadonlySet<Tab> = new Set([
  'coordinator',
  'coordinator-ops',
  'inventory-review',
  'forum-review',
]);

const PHONE_TABS = [
  { tab: 'home', label: 'Home', icon: 'home' },
  { tab: 'map', label: 'Map', icon: 'pin' },
  { tab: 'help', label: 'Ask for help', icon: 'plus' },
  { tab: 'requests', label: 'Requests', icon: 'board' },
  { tab: 'me', label: 'Me', icon: 'user' },
] as const;
const PHONE_ONLY_TABS: ReadonlySet<Tab> = new Set(['help', 'requests', 'me']);
const PHONE_WIDTH = '(max-width: 640px)';

function subscribeToPhoneWidth(notify: () => void): () => void {
  const media = window.matchMedia(PHONE_WIDTH);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

function atPhoneWidth(): boolean {
  return window.matchMedia(PHONE_WIDTH).matches;
}

function partOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default function App(): ReactElement {
  const [selectedCommunity, setSelectedCommunity] = useState<HubId>('domestic-safety');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [askingForHelp, setAskingForHelp] = useState<boolean>(false);
  const [inventoryAction, setInventoryAction] = useState<'request' | 'give' | 'remove' | null>(null);
  // Held in memory only: a reload signs staff out.
  const [coordinatorKey, setCoordinatorKey] = useState<string | null>(null);
  // Forum pseudonym for this session. Memory only, so a reload drops it.
  const [forumHandle, setForumHandle] = useState<string | null>(null);
  const [hubView, setHubView] = useState<HubView>('threads');
  const [priorityAlert, setPriorityAlert] = useState<MissingPersonAlert | null>(null);
  const surveyRef = useRef<HTMLElement>(null);
  const hubRef = useRef<HTMLElement>(null);
  const phoneWidth = useSyncExternalStore(subscribeToPhoneWidth, atPhoneWidth);
  const isStaff = coordinatorKey !== null && STAFF_TABS.has(activeTab);
  const phoneShell = phoneWidth && !isStaff;
  const currentTab = !phoneShell && PHONE_ONLY_TABS.has(activeTab) ? 'home' : activeTab;
  const showHome = currentTab === 'home';
  const showRequests = currentTab === 'requests';
  const surveyOpen = activeTab === 'help' || askingForHelp;
  const showSurvey = currentTab === 'help' || (!phoneShell && showHome && surveyOpen);
  const currentPhoneTab = currentTab === 'inventory' || STAFF_TABS.has(currentTab) || currentTab === 'staff-sign-in'
    ? 'me'
    : currentTab;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/alerts/priority', { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active) {
          setPriorityAlert({
            id: 'priority-alert',
            name: data.title,
            age: 19,
            lastSeenLocation: data.location,
            lastSeenTimeAgo: 'Recent',
            description: data.description,
            active: data.active,
            simulated: data.simulated ?? false,
          });
        } else {
          setPriorityAlert(null);
        }
      })
      .catch(() => setPriorityAlert(null));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (showSurvey && showHome) surveyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showSurvey, showHome]);

  const active = COMMUNITIES.find((c) => c.id === selectedCommunity) ?? COMMUNITIES[0];
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

  function go(tab: Tab): void {
    if (tab === 'help') setAskingForHelp(true);
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }

  function openHub(id: HubId, view: HubView = 'threads'): void {
    setSelectedCommunity(id);
    setHubView(view);
    setActiveTab('home');
    requestAnimationFrame(() => hubRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function navButton(tab: Tab, label: string): ReactElement {
    return (
      <button type="button" aria-current={currentTab === tab ? 'page' : undefined} onClick={() => go(tab)}>
        <span>{label}</span>
      </button>
    );
  }

  const emergencyLine = (
    <div className="sos">
      <Icon name="phone" />
      <span>
        In danger? Call <a href="tel:911">911</a> · 24/7 line <a href={COMFORCE_HOTLINE.tel}>{COMFORCE_HOTLINE.display}</a>
      </span>
    </div>
  );

  const needsSection = (
    <section key="home-needs" className="mod c5 home-needs" aria-labelledby="needs-title">
      <div className="mod-h">
        <h2 id="needs-title">What do you need?</h2>
      </div>
      <div className="needs">
        <button type="button" className="primary" onClick={() => {
          if (phoneShell) go('help');
          else setAskingForHelp(true);
        }}>
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
        <button type="button" onClick={() => openHub('missing-persons', 'tool')}>
          <span className="sq"><Icon name="search" /></span>
          <span><b>Join a search</b><small>Help cover a sector with other neighbors</small></span>
          <Icon name="chev" className="ic chev" />
        </button>
      </div>
      {emergencyLine}
    </section>
  );

  return (
    <div className={phoneShell ? 'app resident-phone' : 'app'}>
      {phoneShell ? (
        <header className="ph-top">
          <button type="button" className="logo" onClick={() => go('home')} aria-label="ComForce MKE home">
            <LogoMark />
            <b>ComForce <span>MKE</span></b>
          </button>
        </header>
      ) : (
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
                {navButton('forum-review', 'Held posts')}
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
        </header>
      )}

      <main className="dpage">
        {phoneShell && showHome && (
          <section className="greet" aria-labelledby="phone-greet-title">
            <div className="kicker">Milwaukee · {weekday}</div>
            <h1 id="phone-greet-title">Good {partOfDay(now)}, <em>neighbor.</em></h1>
          </section>
        )}
        {!isStaff && priorityAlert && (
          <UrgentAlertBanner
            alert={priorityAlert}
            onJoinSearch={() => openHub('missing-persons', 'tool')}
          />
        )}

        {activeTab === 'map' && <CommunityMap />}

        {activeTab === 'inventory' && (
          <InventoryHub initialAction={inventoryAction} onActionHandled={() => setInventoryAction(null)} />
        )}

        {(activeTab === 'staff-sign-in' || (STAFF_TABS.has(activeTab) && !coordinatorKey)) && (
          <CoordinatorSignIn onSignIn={(key) => { setCoordinatorKey(key); go(activeTab === 'staff-sign-in' ? 'coordinator' : activeTab); }} />
        )}

        {activeTab === 'inventory-review' && coordinatorKey && <InventoryReview initialKey={coordinatorKey} />}

        {activeTab === 'forum-review' && coordinatorKey && <ForumReview accessKey={coordinatorKey} />}

        {activeTab === 'coordinator' && coordinatorKey && (
          <CoordinatorDashboard accessKey={coordinatorKey} />
        )}

        {activeTab === 'coordinator-ops' && coordinatorKey && (
          <CoordinatorMap accessKey={coordinatorKey} />
        )}

        {phoneShell && currentTab === 'me' && (
          <div className="phone-menu-page">
            <section className="mod" aria-labelledby="phone-me-title">
              <div className="mod-h"><h2 id="phone-me-title">Me</h2></div>
              <div className="mod-b phone-menu">
                <button type="button" className="btn" onClick={() => go('inventory')}>Inventory</button>
                {coordinatorKey ? (
                  <>
                    <button type="button" className="btn" onClick={() => go('coordinator')}>Coordinator</button>
                    <button type="button" className="btn" onClick={() => setCoordinatorKey(null)}>Sign out</button>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => go('staff-sign-in')}>Staff sign in</button>
                )}
              </div>
            </section>
            <section className="mod" aria-labelledby="phone-safety-title">
              <div className="mod-h"><h2 id="phone-safety-title">Privacy &amp; safety</h2></div>
              <p className="mod-b">Keep your request code private. Anyone with the code can check your request status.</p>
              {emergencyLine}
            </section>
          </div>
        )}

        {!phoneShell && showHome && (
          <section className="greet" aria-labelledby="greet-title">
            <div className="kicker">Milwaukee · {weekday} {partOfDay(now)}</div>
            <h1 id="greet-title">Welcome. <em>Glad you&rsquo;re here.</em></h1>
            <p>
              ComForce MKE connects Milwaukee neighbors with help, safe places, and each other. Here&rsquo;s what&rsquo;s
              happening near you.
            </p>
          </section>
        )}

        {surveyOpen && (
          <div hidden={!showSurvey}>
            <section className="mod" ref={surveyRef} aria-label="Ask for help" style={{ marginBottom: 24, scrollMarginTop: 96 }}>
              <div className="mod-h">
                <h2>Ask for help</h2>
                {showHome && (
                  <button type="button" className="more" onClick={() => {
                    setAskingForHelp(false);
                    if (activeTab === 'help') go('home');
                  }}>Close</button>
                )}
              </div>
              <div className="mod-b">
                <HelpSurvey />
              </div>
            </section>
          </div>
        )}

        <div hidden={!showHome}>
          <div className="g12 stretch">
            {phoneShell && needsSection}
            <section key="home-hubs" className="mod c7" ref={hubRef} aria-labelledby="hubs-title" style={{ scrollMarginTop: 96 }}>
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
                    onClick={() => {
                      setSelectedCommunity(c.id);
                      setHubView('threads');
                    }}
                  >
                    <span className={`sw ${c.swatch}`}><Icon name={c.icon} /></span>
                    <b>{c.name}</b>
                    <small>{c.members} members · {c.openTickets} open</small>
                  </button>
                ))}
              </div>
              <p className="hub-desc">{active.description}</p>

              <div className="hubtabs" role="tablist" aria-label={`${active.name} sections`}>
                <button
                  type="button"
                  role="tab"
                  id="hubtab-threads"
                  aria-controls="hubpanel"
                  aria-selected={hubView === 'threads'}
                  onClick={() => setHubView('threads')}
                >
                  <Icon name="users" />Threads
                </button>
                <button
                  type="button"
                  role="tab"
                  id="hubtab-tool"
                  aria-controls="hubpanel"
                  aria-selected={hubView === 'tool'}
                  onClick={() => setHubView('tool')}
                >
                  <Icon name={active.icon} />{active.tool} <span className="own">This hub</span>
                </button>
              </div>

              <div id="hubpanel" role="tabpanel" aria-labelledby={hubView === 'threads' ? 'hubtab-threads' : 'hubtab-tool'}>
              {hubView === 'threads' && (
                <HubForum
                  key={active.id}
                  hubId={active.id}
                  members={active.members}
                  handle={forumHandle}
                  onHandle={setForumHandle}
                  coordinatorKey={coordinatorKey}
                />
              )}

              {hubView === 'tool' && active.id === 'domestic-safety' && (
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

              {hubView === 'tool' && active.id === 'missing-persons' && (
                <div className="hub-body">
                  <SearchGridMap />
                </div>
              )}

              {hubView === 'tool' && active.id === 'food-pantry' && (
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
              </div>
            </section>

            {!phoneShell && needsSection}
          </div>
        </div>

        <div hidden={!showHome && !showRequests}>
          <div className="g12">
            <div className={showRequests ? 'c12' : 'c7'} hidden={phoneShell && showHome}>
              <VolunteerTickets />
            </div>
            {phoneShell && showHome && (
              <section className="mod c12" aria-labelledby="phone-requests-title">
                <div className="mod-h"><h2 id="phone-requests-title">Neighbors who need a hand</h2></div>
                <div className="mod-b">
                  <button type="button" className="btn" onClick={() => go('requests')}>
                    Browse requests <Icon name="chev" />
                  </button>
                </div>
              </section>
            )}
            {!phoneShell && (
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
            )}
          </div>
        </div>
      </main>

      {phoneShell ? (
        <nav className="tabbar" aria-label="Resident navigation">
          {PHONE_TABS.map(({ tab, label, icon }) => (
            <button
              key={tab}
              type="button"
              className={tab === 'help' ? 'post' : undefined}
              aria-label={tab === 'help' ? label : undefined}
              aria-current={currentPhoneTab === tab ? 'page' : undefined}
              onClick={() => go(tab)}
            >
              <Icon name={icon} />
              {tab !== 'help' && <span>{label}</span>}
            </button>
          ))}
        </nav>
      ) : (
        <footer className="dfoot">
          <span><b>ComForce MKE</b> · Community Task Force MKE · Milwaukee, WI</span>
          <span><b>Made in Milwaukee</b> · prototype, sample data</span>
        </footer>
      )}
    </div>
  );
}
