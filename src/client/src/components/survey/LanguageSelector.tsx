import { LANGUAGES } from '../../i18n/strings';
import { useSurvey } from '../../state/survey';

/**
 * English / Español / Hmoob switch (#3). Comes first in the survey because it has to work before
 * anything else can be read. Each label is written in its own language, and `lang` is set so screen
 * readers pronounce it correctly.
 */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { survey, update, t } = useSurvey();
  return (
    <div role="group" aria-label={t('lang.title')} className="seg lang-seg" data-compact={compact || undefined}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={survey.language === l.code}
          onClick={() => update({ language: l.code })}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
