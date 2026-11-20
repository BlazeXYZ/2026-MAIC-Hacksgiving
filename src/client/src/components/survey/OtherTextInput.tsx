import { useEffect, useId, useRef, useState } from 'react';
import { FREE_TEXT_MAX, freeTextProblem, useSurvey } from '../../state/survey';

const COMMIT_DELAY_MS = 250;

interface Props {
  /** Expanded and focused when true. Collapsed (but kept, so typed text survives) when false. */
  open: boolean;
  /** "Other" needs words; for preset needs the box is an optional extra. */
  required: boolean;
}

/**
 * Free-text box for needs that don't fit a preset (#5). The counter updates on every keystroke;
 * the survey context is updated on a short debounce and on blur, so typing stays smooth.
 */
export function OtherTextInput({ open, required }: Props) {
  const { survey, update, t } = useSurvey();
  const [text, setText] = useState(survey.freeText);
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ freeText: text }), COMMIT_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [text, update]);

  useEffect(() => {
    if (open && required) ref.current?.focus({ preventScroll: true });
  }, [open, required]);

  const problem = freeTextProblem(text, required);
  const showProblem = problem === 'over' || (problem === 'empty' && touched);
  const over = text.length - FREE_TEXT_MAX;

  return (
    <div className="expander" data-open={open || undefined} aria-hidden={!open}>
      <div className="expander-inner">
        <div className="field">
          <label htmlFor={id}>{required ? t('other.label') : t('other.optional')}</label>
          <textarea
            id={id}
            ref={ref}
            rows={4}
            value={text}
            tabIndex={open ? 0 : -1}
            placeholder={t('other.placeholder')}
            aria-required={required}
            aria-invalid={showProblem}
            aria-describedby={`${id}-count ${id}-msg`}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              setTouched(true);
              clearTimeout(timer.current);
              update({ freeText: text });
            }}
          />
          <div className="field-foot">
            <span id={`${id}-msg`} className="field-error" role={showProblem ? 'alert' : undefined}>
              {showProblem ? (problem === 'over' ? t('other.over', { n: over }) : t('other.empty')) : ''}
            </span>
            <span id={`${id}-count`} className="counter" data-over={over > 0 || undefined} aria-live="polite">
              {t('other.count', { n: text.length, max: FREE_TEXT_MAX })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
