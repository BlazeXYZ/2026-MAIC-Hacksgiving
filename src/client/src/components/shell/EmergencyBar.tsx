import { Phone } from 'lucide-react';
import { useSurvey } from '../../state/survey';
import './shell.css';

export const COMFORCE_HOTLINE = { display: '414-395-0552', tel: 'tel:4143950552' } as const;

/**
 * Always-visible call bar for the intake screens (#7). One tap dials 911 or the ComForce 24/7 line,
 * so someone in a crisis never has to finish a form first.
 */
export function EmergencyBar() {
  const { t } = useSurvey();
  return (
    <div className="emergency" role="region" aria-label={t('emergency.lede')}>
      <span className="emergency-lede">{t('emergency.lede')}</span>
      <a className="emergency-call is-911" href="tel:911">
        <Phone aria-hidden="true" />
        {t('emergency.911')}
      </a>
      <a className="emergency-call" href={COMFORCE_HOTLINE.tel} aria-label={`${t('emergency.line')} ${COMFORCE_HOTLINE.display}`}>
        <Phone aria-hidden="true" />
        <span>
          <span className="emergency-line-label">{t('emergency.line')} </span>
          {COMFORCE_HOTLINE.display}
        </span>
      </a>
    </div>
  );
}
