import { LANGUAGES } from '../../i18n/strings';
import { useSurvey } from '../../state/survey';

/**
 * English / Español / Hmoob (#3). On the welcome hero it's the mockup's top-right `.lang` toggle,
 * the first thing on the first screen, so it works before anything else has to be read.
 * Each label is in its own language, with `lang` set so screen readers say it right.
 */
export function LanguageSelector({ variant = 'hero' }: { variant?: 'hero' | 'seg' }) {
  const { survey, update, t } = useSurvey();
  return (
    <div role="group" aria-label={t('lang.title')} className={variant === 'hero' ? 'lang' : 'seg'}>
      {LANGUAGES.map((l) => (
        <button key={l.code} type="button" lang={l.code} aria-pressed={survey.language === l.code} onClick={() => update({ language: l.code })}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
