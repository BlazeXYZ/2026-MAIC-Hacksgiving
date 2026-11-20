import { Icon, type IconName } from './Icon';
import { NEEDS, useSurvey, type Need } from '../state/survey';

const NEED_ICONS: Record<Need, IconName> = {
  food: 'food',
  ride: 'ride',
  safe: 'shield',
  warm: 'flame',
  talk: 'msg',
  other: 'spark',
};

interface Props {
  /** Called after a need is picked (home uses it to open the ask chat). */
  onPick?: (need: Need) => void;
  /** Smaller tiles without the second line, for inside a chat bubble. */
  compact?: boolean;
  disabled?: boolean;
}

/**
 * "What do you need?" option cards (#2): Food, Ride, Safe place, Warm lobby, Talk to someone, Other,
 * drawn as the v9 mockup's home tiles. The choice goes into the shared survey state, so the ask chat,
 * the "Other" free-text box (#5) and the review card (#6) all see it.
 */
export default function HelpSurvey({ onPick, compact = false, disabled = false }: Props) {
  const { survey, update, t } = useSurvey();
  return (
    <div className="need4" role="radiogroup" aria-label={t('need.title')}>
      {NEEDS.map((need) => (
        <button
          key={need}
          type="button"
          role="radio"
          aria-checked={survey.need === need}
          className={!compact && need === 'food' ? 'g' : undefined}
          disabled={disabled}
          onClick={() => {
            update({ need });
            onPick?.(need);
          }}
        >
          <Icon name={NEED_ICONS[need]} />
          <span>
            <b>{t(`need.${need}`)}</b>
            {!compact && <small>{t(`need.${need}.d`)}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}
