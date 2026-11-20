import type { ReactNode } from 'react';
import { Icon, LogoMark, type IconName } from '../Icon';
import { useQuickExit } from '../../state/quickExit';
import { useSurvey } from '../../state/survey';

/**
 * Phone screen header from the mockup (`.ph-head`): back button, small label over a big title,
 * then the red Exit button in the same top-right spot on every screen.
 * Exit runs Quick Exit (#8); Esc does the same from anywhere (see state/quickExit).
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
      <button type="button" className="exit" onClick={exit} aria-keyshortcuts="Escape">
        <Icon name="eyeoff" />
        {t('exit')}
      </button>
    </div>
  );
}

export type Tab = 'home' | 'map' | 'ask' | 'requests' | 'me';

type TabLabel = 'tab.home' | 'tab.map' | 'tab.ask' | 'tab.requests' | 'tab.me';

const TABS: Array<{ id: Tab; icon: IconName; label: TabLabel }> = [
  { id: 'home', icon: 'home', label: 'tab.home' },
  { id: 'map', icon: 'pin', label: 'tab.map' },
  { id: 'ask', icon: 'plus', label: 'tab.ask' },
  { id: 'requests', icon: 'board', label: 'tab.requests' },
  { id: 'me', icon: 'user', label: 'tab.me' },
];

/** Home screen top row from the mockup (`.ph-top`): logo, notifications bell, red Exit. */
export function PhoneTop() {
  const { exit } = useQuickExit();
  const { t } = useSurvey();
  return (
    <div className="ph-top">
      <span className="logo">
        <LogoMark />
        <b>
          ComForce <span>MKE</span>
        </b>
      </span>
      <span className="iconbtn" role="img" aria-label={t('home.bell')} title={`${t('home.bell')} · ${t('notbuilt')}`}>
        <Icon name="bell" />
        <span className="badge" />
      </span>
      <button type="button" className="exit" onClick={exit} aria-keyshortcuts="Escape">
        <Icon name="eyeoff" />
        {t('exit')}
      </button>
    </div>
  );
}

/** Desktop bar from the mockup (`.dnav`), shown from 900px. */
export function DeskNav({ current, onNav }: { current: Tab | null; onNav: (tab: Tab) => void }) {
  const { exit } = useQuickExit();
  const { t } = useSurvey();
  return (
    <header className="dnav">
      <a
        className="logo"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onNav('home');
        }}
      >
        <LogoMark />
        <b>
          ComForce <span>MKE</span>
        </b>
      </a>
      <nav aria-label={t('nav.main')}>
        {TABS.filter((tab) => tab.id !== 'ask').map((tab) => (
          <button key={tab.id} type="button" aria-current={current === tab.id ? 'page' : undefined} onClick={() => onNav(tab.id)}>
            <span>{t(tab.id === 'me' ? 'tab.me.desk' : tab.label)}</span>
          </button>
        ))}
      </nav>
      <div className="dtools">
        <button type="button" className="btn primary" onClick={() => onNav('ask')}>
          <Icon name="plus" />
          {t('tab.ask')}
        </button>
        <button type="button" className="esc" onClick={exit} aria-keyshortcuts="Escape">
          <kbd>esc</kbd>
          {t('exit.desk')}
        </button>
      </div>
    </header>
  );
}

/** Bottom tab bar from the mockup; the green + opens Ask for help. */
export function TabBar({ current, onNav }: { current: Tab | null; onNav: (tab: Tab) => void }) {
  const { t } = useSurvey();
  return (
    <nav className="tabbar" aria-label={t('nav.app')}>
      {TABS.map((tab) =>
        tab.id === 'ask' ? (
          <button key={tab.id} type="button" className="post" onClick={() => onNav('ask')} aria-label={t(tab.label)}>
            <Icon name={tab.icon} />
          </button>
        ) : (
          <button key={tab.id} type="button" aria-current={current === tab.id ? 'page' : undefined} onClick={() => onNav(tab.id)}>
            <Icon name={tab.icon} />
            <span>{t(tab.label)}</span>
          </button>
        ),
      )}
    </nav>
  );
}

/** Green fenced desktop footer from the PROD mockup, at the end of every wide page (hidden on phones). */
export function DeskFoot() {
  const { t } = useSurvey();
  return (
    <footer className="dfoot">
      <span>
        <b>ComForce MKE</b> · Community Task Force MKE · Milwaukee, WI · 24/7: 414-395-0552
      </span>
      <span>{t('foot.links')}</span>
      <span>
        <span className="made">{t('foot.made')}</span> · {t('foot.proto')}
      </span>
    </footer>
  );
}
