import type { ReactNode } from 'react';
import { Icon, LogoMark, type IconName } from '../Icon';
import { useQuickExit } from '../../state/quickExit';
import { useSurvey } from '../../state/survey';

/**
 * Phone screen header from the mockup (`.ph-head`): back button, small label over a big title,
 * then the red Exit button in the same top-right spot on every screen.
 * The Exit here is a stand-in that calls `exit()`; #8 owns the real button and the Esc key.
 */
export function PhoneHead({ meta, title, onBack, extra }: { meta: string; title: string; onBack?: () => void; extra?: ReactNode }) {
  const { exit } = useQuickExit();
  const { t } = useSurvey();
  return (
    <div className="ph-head">
      {onBack && (
        <button type="button" className="back" onClick={onBack} aria-label={t('nav.back')}>
          <Icon name="back" />
        </button>
      )}
      <div className="t">
        <span className="meta">{meta}</span>
        <b>{title}</b>
      </div>
      {extra}
      <button type="button" className="exit" onClick={exit}>
        <Icon name="eyeoff" />
        {t('exit')}
      </button>
    </div>
  );
}

/** Desktop bar from the mockup (`.dnav`), shown from 900px. Screens that aren't built yet are disabled. */
export function DeskNav({ onLogo }: { onLogo: () => void }) {
  const { exit } = useQuickExit();
  const { t } = useSurvey();
  const items = [t('tab.home'), t('tab.map'), t('nav.hubs'), t('tab.requests')];
  return (
    <header className="dnav">
      <a
        className="logo"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onLogo();
        }}
      >
        <LogoMark />
        <b>
          ComForce <span>MKE</span>
        </b>
      </a>
      <nav aria-label="Main">
        {items.map((label) => (
          <button key={label} type="button" aria-disabled="true" title={t('notbuilt')}>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="dtools">
        {/* Stand-in until #8: same look as the mockup's `.esc` button. */}
        <button type="button" className="esc" onClick={exit}>
          <kbd>esc</kbd>
          {t('exit.desk')}
        </button>
      </div>
    </header>
  );
}

type Tab = 'home' | 'map' | 'ask' | 'requests' | 'me';

const TABS: Array<{ id: Tab; icon: IconName; label: 'tab.home' | 'tab.map' | 'tab.ask' | 'tab.requests' | 'tab.me' }> = [
  { id: 'home', icon: 'home', label: 'tab.home' },
  { id: 'map', icon: 'pin', label: 'tab.map' },
  { id: 'ask', icon: 'plus', label: 'tab.ask' },
  { id: 'requests', icon: 'board', label: 'tab.requests' },
  { id: 'me', icon: 'user', label: 'tab.me' },
];

/** Bottom tab bar from the mockup. Only "Ask for help" (the green +) has a screen so far. */
export function TabBar({ onAsk }: { onAsk: () => void }) {
  const { t } = useSurvey();
  return (
    <nav className="tabbar" aria-label="App">
      {TABS.map((tab) =>
        tab.id === 'ask' ? (
          <button key={tab.id} type="button" className="post" onClick={onAsk} aria-label={t(tab.label)}>
            <Icon name={tab.icon} />
          </button>
        ) : (
          <button key={tab.id} type="button" aria-disabled="true" title={t('notbuilt')}>
            <Icon name={tab.icon} />
            <span>{t(tab.label)}</span>
          </button>
        ),
      )}
    </nav>
  );
}
