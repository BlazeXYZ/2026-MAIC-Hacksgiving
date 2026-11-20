import { Icon } from '../Icon';
import { useSurvey } from '../../state/survey';

export const COMFORCE_HOTLINE = { display: '414-395-0552', tel: 'tel:4143950552' } as const;

/**
 * The mockup's "In danger right now?" line (#7), pinned in every intake screen's footer so it never
 * scrolls away. One tap dials 911 or the ComForce 24/7 line, so nobody has to finish a form first.
 */
export function EmergencyBar() {
  const { t } = useSurvey();
  return (
    <div className="sos" role="region" aria-label={t('emergency.lede')}>
      <Icon name="phone" />
      <span>{t('emergency.lede')}</span>
      <a className="n911" href="tel:911">
        {t('emergency.911')}
      </a>
      <a href={COMFORCE_HOTLINE.tel} aria-label={`${t('emergency.line')} ${COMFORCE_HOTLINE.display}`}>
        24/7 {COMFORCE_HOTLINE.display}
      </a>
    </div>
  );
}
