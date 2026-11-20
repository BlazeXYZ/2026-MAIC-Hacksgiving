import { Icon, LogoMark, Skyline, type IconName } from '../components/Icon';
import { EmergencyBar } from '../components/shell/EmergencyBar';
import { LanguageSelector } from '../components/survey/LanguageSelector';
import { useSurvey, type HubId, type Intent } from '../state/survey';
import type { StringKey } from '../i18n/strings';

/** Hubs pre-checked on the next screen, from this answer (mockup frame 2). */
const HUBS_FOR: Record<Intent, HubId[]> = { need: ['food', 'rides'], give: ['food', 'parents'], look: ['food'] };

const CHOICES: Array<{ id: Intent; icon: IconName; title: StringKey; sub: StringKey }> = [
  { id: 'need', icon: 'hand', title: 'welcome.need', sub: 'welcome.need.d' },
  { id: 'give', icon: 'users', title: 'welcome.give', sub: 'welcome.give.d' },
  { id: 'look', icon: 'search', title: 'welcome.look', sub: 'welcome.look.d' },
];

/**
 * Mockup screen 1 · Welcome. The green fenced hero carries the language toggle (#3), top right,
 * so language is chosen before anything else has to be read.
 */
export function WelcomeScreen({ onContinue, onCheck }: { onContinue: () => void; onCheck: () => void }) {
  const { survey, update, t } = useSurvey();
  return (
    <div className="view ob">
      <div className="view-body">
        <div className="hero">
          <LanguageSelector />
          <span className="mark" aria-hidden="true">
            <LogoMark />
          </span>
          <h1 className="voice">{t('welcome.title')}</h1>
          <Skyline />
        </div>
        <div style={{ padding: '24px 24px 24px' }}>
          <p style={{ fontSize: 16, fontWeight: 700 }} id="welcome-q">
            {t('welcome.q')}
          </p>
          <p className="meta" style={{ marginTop: 2 }}>
            {t('welcome.q.help')}
          </p>
          <div className="choice" role="group" aria-labelledby="welcome-q">
            {CHOICES.map((c) => (
              <button key={c.id} type="button" aria-pressed={survey.intent === c.id} onClick={() => update({ intent: c.id, hubs: HUBS_FOR[c.id] })}>
                <span className="sq">
                  <Icon name={c.icon} />
                </span>
                <span>
                  <b>{t(c.title)}</b>
                  <small>{t(c.sub)}</small>
                </span>
                <span className="radio" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="view-foot ob-foot">
        <EmergencyBar />
        <button type="button" className="btn primary block" onClick={onContinue}>
          {t('welcome.continue')}
        </button>
        <p className="alt">
          {t('welcome.alt')} ·{' '}
          <button type="button" onClick={onCheck}>
            {t('welcome.check')}
          </button>
        </p>
      </div>
    </div>
  );
}
