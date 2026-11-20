import { Icon } from '../components/Icon';
import { EmergencyBar } from '../components/shell/EmergencyBar';
import { DistrictPicker } from '../components/survey/DistrictPicker';
import { useSurvey } from '../state/survey';

/** Mockup screen 2 · "Where are you, roughly?" (#4). Continue stays off until a neighborhood is set. */
export function AreaScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const { survey, t } = useSurvey();
  return (
    <div className="view ob">
      <div className="stepper">
        <button type="button" className="back" onClick={onBack} aria-label={t('nav.back')}>
          <Icon name="back" />
        </button>
        <span className="bars" aria-hidden="true">
          <i className="on" />
          <i className="on" />
        </span>
        <span className="meta">{t('step.of', { n: 2, total: 2 })}</span>
      </div>
      <div className="view-body ob-body" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <h1>{t('district.title')}</h1>
        <p className="lede">{t('district.help')}</p>
        <DistrictPicker />
      </div>
      <div className="view-foot ob-foot">
        <EmergencyBar />
        <button type="button" className="btn primary block" disabled={!survey.district} onClick={onContinue}>
          {t('welcome.continue')}
        </button>
      </div>
    </div>
  );
}
