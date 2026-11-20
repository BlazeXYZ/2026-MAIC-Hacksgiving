import { useEffect, useState } from 'react';
import { clearSampleTickets } from './api/intake';
import { IconSprite } from './components/Icon';
import { DeskNav } from './components/shell/Frame';
import { AreaScreen } from './screens/AreaScreen';
import { AskScreen } from './screens/AskScreen';
import { StatusScreen } from './screens/StatusScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { QuickExitProvider, useQuickExit } from './state/quickExit';
import { SurveyProvider } from './state/survey';
import { useTripleTap } from './state/useTripleTap';

type Screen = 'welcome' | 'area' | 'ask' | 'status';

export default function App() {
  return (
    <QuickExitProvider>
      <IconSprite />
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

/** Resident flow from the v9 mockup: Welcome → Area → Ask (chat) → Status. */
function Shell() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [token, setToken] = useState<string | null>(null);

  return (
    <div className="app app-desk">
      <DeskNav onLogo={() => setScreen('welcome')} />
      {screen === 'welcome' && <WelcomeScreen onContinue={() => setScreen('area')} onCheck={() => setScreen('status')} />}
      {screen === 'area' && <AreaScreen onBack={() => setScreen('welcome')} onContinue={() => setScreen('ask')} />}
      {screen === 'ask' && (
        <AskScreen
          onBack={() => setScreen('area')}
          onFollow={(code) => {
            setToken(code);
            setScreen('status');
          }}
        />
      )}
      {screen === 'status' && <StatusScreen token={token} onToken={setToken} onBack={() => setScreen(token ? 'ask' : 'welcome')} onAsk={() => setScreen('ask')} />}
    </div>
  );
}

/**
 * Stand-in for #9's disguise, matching the mockup's decoy screen. It exists so the #10 return gesture
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
    <div className="decoy">
      <header {...tripleTap}>
        <h3>Transit Schedule</h3>
        <p>Route 30 · Sherman–Wisconsin · Eastbound</p>
      </header>
      <div className="next">
        Next bus at N Broadway &amp; E State St<b>6 min</b>
      </div>
      <ol>
        <li><span>N Broadway &amp; E State St</span><span>6:18 PM</span></li>
        <li><span>N Water St &amp; E Kilbourn Ave</span><span>6:21 PM</span></li>
        <li><span>E Wisconsin Ave &amp; N Jackson St</span><span>6:24 PM</span></li>
        <li><span>N Prospect Ave &amp; E Ogden Ave</span><span>6:28 PM</span></li>
        <li><span>N Farwell Ave &amp; E Brady St</span><span>6:31 PM</span></li>
      </ol>
      <p className="fine">Times are estimates. Arrivals refresh every 30 seconds.</p>
    </div>
  );
}
