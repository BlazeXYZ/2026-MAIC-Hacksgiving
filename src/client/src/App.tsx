import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { clearSampleTickets } from './api/intake';
import { EmergencyBar } from './components/shell/EmergencyBar';
import { LanguageSelector } from './components/survey/LanguageSelector';
import { AskScreen } from './screens/AskScreen';
import { CommunitiesDemo } from './screens/CommunitiesDemo';
import { StatusScreen } from './screens/StatusScreen';
import { QuickExitProvider, useQuickExit } from './state/quickExit';
import { SurveyProvider, useSurvey } from './state/survey';
import { useTripleTap } from './state/useTripleTap';
import './components/shell/shell.css';

type Screen = 'home' | 'ask' | 'status';

export default function App() {
  return (
    <QuickExitProvider>
      <Root />
    </QuickExitProvider>
  );
}

function Root() {
  const { exited, session, onExit } = useQuickExit();

  useEffect(() => onExit(clearSampleTickets), [onExit]);

  if (exited) return <DisguiseStandIn />;
  // A new key after every exit throws away all survey answers and screen state below it (#10).
  return (
    <SurveyProvider key={session}>
      <Shell />
    </SurveyProvider>
  );
}

function Shell() {
  const { exit } = useQuickExit();
  const { t } = useSurvey();
  const [screen, setScreen] = useState<Screen>('ask');
  const [token, setToken] = useState<string | null>(null);
  const showEmergency = screen !== 'home';

  const nav: Array<[Screen, string]> = [
    ['home', 'Home'],
    ['ask', t('ask.kicker')],
    ['status', t('status.title')],
  ];

  return (
    <>
      <div className="chrome">
        <div className="appbar">
          <a className="logo" href="/" onClick={(e) => (e.preventDefault(), setScreen('home'))}>
            ComForce <span>MKE</span>
          </a>
          <nav className="appnav" aria-label="Main">
            {nav.map(([id, label]) => (
              <button key={id} type="button" aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>
                {label}
              </button>
            ))}
          </nav>
          <span className="spacer" />
          {screen !== 'ask' && <LanguageSelector compact />}
          {/* Stand-in trigger until #8 adds the real Quick Exit button and the Esc shortcut. */}
          <button type="button" className="exit-standin" onClick={exit}>
            <EyeOff aria-hidden="true" />
            Exit
          </button>
        </div>
        {showEmergency && <EmergencyBar />}
      </div>

      {screen === 'home' && <CommunitiesDemo />}
      {screen === 'ask' && (
        <AskScreen
          onSubmitted={(code) => {
            setToken(code);
            setScreen('status');
          }}
        />
      )}
      {screen === 'status' && <StatusScreen token={token} onToken={setToken} onNewRequest={() => setScreen('ask')} />}
    </>
  );
}

/**
 * Stand-in disguise until #9 builds the real MCTS schedule. It only exists so the #10 return gesture
 * can be used: three deliberate taps on the blue bar bring the app back.
 */
function DisguiseStandIn() {
  const { restore } = useQuickExit();
  const tripleTap = useTripleTap(restore);

  useEffect(() => {
    const previous = document.title;
    document.title = 'MCTS Route 30 Schedule';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="disguise">
      <header className="disguise-bar" {...tripleTap}>
        <h1>Transit Schedule</h1>
        <p>Route 30 · Sherman–Wisconsin · Eastbound</p>
      </header>
      <ol>
        <li><span>N Broadway &amp; E State St</span><span>6:18 PM</span></li>
        <li><span>N Water St &amp; E Kilbourn Ave</span><span>6:21 PM</span></li>
        <li><span>E Wisconsin Ave &amp; N Jackson St</span><span>6:24 PM</span></li>
        <li><span>N Prospect Ave &amp; E Ogden Ave</span><span>6:28 PM</span></li>
      </ol>
    </div>
  );
}
