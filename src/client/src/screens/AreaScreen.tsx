import { Icon, type IconName } from '../components/Icon';
import { EmergencyBar } from '../components/shell/EmergencyBar';
import { DistrictPicker } from '../components/survey/DistrictPicker';
import { DISTRICTS, useSurvey, type HubId } from '../state/survey';
import type { StringKey } from '../i18n/strings';

const HUBS: Array<{ id: HubId; icon: IconName; color: string; title: StringKey; sub: StringKey }> = [
  { id: 'food', icon: 'food', color: 'var(--green)', title: 'hub.food', sub: 'pick.food.d' },
  { id: 'rides', icon: 'ride', color: '#2F5D9E', title: 'pick.rides', sub: 'pick.rides.d' },
  { id: 'safety', icon: 'shield', color: 'var(--ink)', title: 'pick.safety', sub: 'pick.safety.d' },
  { id: 'parents', icon: 'family', color: '#3E7DB3', title: 'pick.parents', sub: 'pick.parents.d' },
];

/** Mockup frame 2 · Area and hubs: neighborhood (#4), then hubs pre-checked from the welcome answer. */
export function AreaScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const { survey, update, t } = useSurvey();
  const area = DISTRICTS.find((d) => d.id === survey.district)?.name ?? 'Milwaukee';

  function toggle(id: HubId) {
    update({ hubs: survey.hubs.includes(id) ? survey.hubs.filter((h) => h !== id) : [...survey.hubs, id] });
  }

  return (
    <div className="view ob">
      <div className="stepper">
        <button type="button" className="back" onClick={onBack} aria-label={t('nav.back')}>
          <Icon name="back" />
        </button>
        <span className="bars" aria-hidden="true">
          <i className="on" />
          <i className="on" />
          <i />
        </span>
        <span className="meta">{t('step.of', { n: 2, total: 3 })}</span>
      </div>
      <div className="view-body ob-body" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <h1>{t('district.title')}</h1>
        <p className="lede">{t('district.help')}</p>
        <DistrictPicker />

        <h2 id="hubs-pick">{t('pick.title')}</h2>
        <p className="sub">{t('pick.sub', { area })}</p>
        <div className="pick" role="group" aria-labelledby="hubs-pick">
          {HUBS.map((h) => (
            <button key={h.id} type="button" aria-pressed={survey.hubs.includes(h.id)} onClick={() => toggle(h.id)}>
              <span className="sw" style={{ background: h.color }}>
                <Icon name={h.icon} />
              </span>
              <span>
                <b>{t(h.title)}</b>
                <small>{t(h.sub)}</small>
              </span>
              <span className="box">
                <Icon name="check" />
              </span>
            </button>
          ))}
        </div>
        <p className="meta" style={{ marginTop: 12 }}>
          {t('pick.note')}
        </p>
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
