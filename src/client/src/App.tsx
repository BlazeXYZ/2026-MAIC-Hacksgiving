import { useState } from 'react';
import DeliveryCover from './components/DeliveryCover';
import { CrashScreen } from './components/shell/CrashScreen';
import { IconSprite } from './components/Icon';
import { DeskNav, type Tab } from './components/shell/Frame';
import { AreaScreen } from './screens/AreaScreen';
import { AskScreen } from './screens/AskScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LessonScreen } from './screens/LessonScreen';
import { MapScreen, RequestsScreen } from './screens/HubScreens';
import { StatusScreen } from './screens/StatusScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { QuickExitProvider, useQuickExit } from './state/quickExit';
import { SurveyProvider, useSurvey } from './state/survey';
import { useFenceAlignment } from './state/useFenceAlignment';

type Screen = 'welcome' | 'area' | 'lesson' | Tab;

export default function App() {
  return (
    <QuickExitProvider>
      <IconSprite />
      <Root />
    </QuickExitProvider>
  );
}

function Root() {
  const { exited, exit, restore } = useQuickExit();

  // Quick Exit (#8): the delivery catalog covers the app. The app stays mounted underneath (hidden, so it
  // can't be seen, focused or read by a screen reader), and Return to Portal / three taps bring it back as it was.
  return (
    <>
      <div hidden={exited}>
        <CrashScreen onExit={exit}>
          <SurveyProvider>
            <Shell start="welcome" />
          </SurveyProvider>
        </CrashScreen>
      </div>
      {exited && <DeliveryCover onReturn={restore} />}
    </>
  );
}

/**
 * One app, two halves of the team's work:
 * first visit (Welcome → Area → Quick Exit lesson) then the tabs: Home (hubs + need cards), Map (Leaflet), Ask (chat intake),
 * Requests (volunteer tickets), Me (request status). Phone layout first; the mockup's desktop bar from 900px.
 */
function Shell({ start }: { start: Screen }) {
  const { survey } = useSurvey();
  useFenceAlignment();
  const [history, setHistory] = useState<Screen[]>([start]);
  const [token, setToken] = useState<string | null>(null);
  const screen = history[history.length - 1];

  function go(next: Screen) {
    setHistory((h) => (h[h.length - 1] === next ? h : [...h, next]));
  }

  function back(fallback: Screen = 'home') {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : [fallback]));
  }

  // Tabs reset the back stack so Back from a tab goes Home, not through every tab visited.
  function nav(tab: Tab) {
    setHistory((h) => (h[h.length - 1] === tab ? h : tab === 'home' ? ['home'] : ['home', tab]));
  }

  function finishSetup() {
    const next: Record<typeof survey.intent, Tab> = { need: 'ask', give: 'requests', look: 'home' };
    setHistory(next[survey.intent] === 'home' ? ['home'] : ['home', next[survey.intent]]);
  }

  const current: Tab | null = screen === 'welcome' || screen === 'area' || screen === 'lesson' ? null : screen;

  return (
    <div className="app app-desk">
      <DeskNav current={current} onNav={nav} />
      {screen === 'welcome' && <WelcomeScreen onContinue={() => go('area')} onCheck={() => go('me')} />}
      {screen === 'area' && <AreaScreen onBack={() => back('welcome')} onContinue={() => go('lesson')} />}
      {screen === 'lesson' && <LessonScreen onBack={() => back('area')} onFinish={finishSetup} />}
      {screen === 'home' && <HomeScreen onNav={nav} onAsk={() => go('ask')} />}
      {screen === 'map' && <MapScreen onNav={nav} onBack={() => back()} />}
      {screen === 'requests' && <RequestsScreen onNav={nav} />}
      {screen === 'ask' && (
        <AskScreen
          onBack={() => back()}
          onMap={() => go('map')}
          onFollow={(code) => {
            setToken(code);
            nav('me');
          }}
        />
      )}
      {screen === 'me' && <StatusScreen token={token} onToken={setToken} onBack={() => back()} onNav={nav} />}
    </div>
  );
}
