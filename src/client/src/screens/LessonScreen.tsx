import { Icon } from '../components/Icon';
import { EmergencyBar } from '../components/shell/EmergencyBar';
import { useQuickExit } from '../state/quickExit';
import { useSurvey } from '../state/survey';

/**
 * Mockup frame 3 · Quick Exit lesson. Shows once during setup. "Try it now" really opens the
 * delivery-menu cover; Return to Portal (or three taps on its white bar) comes back here.
 */
export function LessonScreen({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const { t } = useSurvey();
  const { exit, shake, setShake } = useQuickExit();

  return (
    <div className="view ob">
      <div className="stepper">
        <button type="button" className="back" onClick={onBack} aria-label={t('nav.back')}>
          <Icon name="back" />
        </button>
        <span className="bars" aria-hidden="true">
          <i className="on" />
          <i className="on" />
          <i className="on" />
        </span>
        <span className="meta">{t('step.of', { n: 3, total: 3 })}</span>
      </div>
      <div className="view-body ob-body" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <h1>{t('lesson.title')}</h1>
        <p className="lede">
          {t('lesson.lede.a')} <b>{t('exit')}</b>. {t('lesson.lede.b')}
        </p>

        <div className="demo" aria-hidden="true">
          <div className="mini">
            <div className="bar">
              <span className="x">{t('exit')}</span>
            </div>
            <div className="ln" />
            <div className="ln s" />
            <div className="ln r" />
            <div className="ln" />
            <div className="ln s" />
          </div>
          <Icon name="arrow" className="arrow" />
          <div className="mini deliv">
            <div className="hd">
              <i />
              Supper Lane
            </div>
            <div className="ban">Dinner, handled.</div>
            <div className="row">
              <span>Copper Bun Kitchen</span>
              <span>4.8</span>
            </div>
            <div className="row">
              <span>Brick &amp; Basil Pizza</span>
              <span>4.9</span>
            </div>
            <div className="row">
              <span>Bright Bowl Counter</span>
              <span>4.7</span>
            </div>
          </div>
          <div className="cap">
            <span>{t('lesson.cap.a')}</span>
            <span />
            <span>{t('lesson.cap.b')}</span>
          </div>
        </div>

        <ul className="how">
          <li>
            <span>
              <b>{t('lesson.how1.b')}</b> {t('lesson.how1')}
            </span>
          </li>
          <li>
            <span>
              <b>{t('lesson.how2.b')}</b> {t('lesson.how2')}
            </span>
          </li>
        </ul>

        <div className="setrow">
          <span>
            <b id="shake-label">{t('lesson.shake')}</b>
            <small>{t('lesson.shake.d')}</small>
          </span>
          <button type="button" className="switch" role="switch" aria-checked={shake} aria-labelledby="shake-label" onClick={() => void setShake(!shake)} />
        </div>
      </div>
      <div className="view-foot ob-foot">
        <EmergencyBar />
        <button type="button" className="btn block" onClick={exit}>
          <Icon name="eyeoff" />
          {t('lesson.try')}
        </button>
        <button type="button" className="btn primary block" onClick={onFinish}>
          {t('lesson.finish')}
        </button>
      </div>
    </div>
  );
}
