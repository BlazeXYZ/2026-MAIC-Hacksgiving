import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { FREE_TEXT_MAX, freeTextProblem, useSurvey } from '../../state/survey';

const COMMIT_DELAY_MS = 250;

/** The bits of the Web Speech API this input uses. */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface Props {
  /** True when "Something else" is picked: the box grows, takes focus and must have words to send. */
  open: boolean;
  disabled: boolean;
  /** Start blank (after a send) instead of from the saved text (after Edit). Remount with a new `key` to switch. */
  startEmpty?: boolean;
  onSend: (text: string) => void;
}

/**
 * The free-text box (#5), drawn as the mockup's chat input bar: mic, a rounded field, a green send button.
 * The character count updates on every keystroke; the survey context is updated on a short debounce
 * and on send, so typing stays smooth. Text is kept when the resident taps Edit later.
 */
export function ChatInput({ open, disabled, startEmpty = false, onSend }: Props) {
  const { survey, update, t } = useSurvey();
  const [text, setText] = useState(startEmpty ? '' : survey.freeText);
  const textRef = useRef(text);
  textRef.current = text;
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const id = useId();

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ freeText: next }), COMMIT_DELAY_MS);
  }

  useEffect(() => {
    if (open && !disabled) ref.current?.focus({ preventScroll: true });
  }, [open, disabled]);

  // Grow with the text, up to the CSS max-height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // When empty, let CSS decide: a wrapped placeholder would otherwise make the box tall.
    if (text) el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  // An empty box is fine to leave, but there is nothing to send.
  const problem = freeTextProblem(text, true);
  const over = text.length - FREE_TEXT_MAX;
  const showCount = open || text.length > 0;

  // Voice input (PROD mockup: the mic turns red while listening). Uses the browser's speech recognition
  // where it exists; elsewhere the button still toggles so people see it was heard.
  const [listening, setListening] = useState(false);
  const recog = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => recog.current?.stop(), []);

  function toggleMic() {
    if (listening) {
      recog.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setListening(true);
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = survey.language === 'es' ? 'es-US' : 'en-US';
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results, (res) => res[0].transcript).join(' ').trim();
      // Read the box as it is now (it may have been typed in while listening), not as it was when the mic started.
      const current = textRef.current;
      if (said) change(current ? `${current} ${said}` : said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recog.current = r;
    r.start();
  }

  function send() {
    recog.current?.stop();
    setListening(false);
    if (problem || disabled) return;
    clearTimeout(timer.current);
    update({ freeText: text });
    onSend(text);
  }

  return (
    <div className="inputbar" data-open={open || undefined}>
      <button
        type="button"
        className={listening ? 'listening' : undefined}
        aria-pressed={listening}
        aria-label={listening ? t('chat.mic.stop') : t('chat.mic')}
        disabled={disabled}
        onClick={toggleMic}
      >
        <Icon name="mic" />
      </button>
      <div className="grow">
        <label htmlFor={id} className="visually-hidden">
          {open ? t('other.label') : t('chat.placeholder')}
        </label>
        <textarea
          id={id}
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={listening ? t('chat.listening') : open ? t('other.placeholder') : t('chat.placeholder')}
          aria-invalid={problem === 'over'}
          aria-describedby={`${id}-count`}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="count" id={`${id}-count`} hidden={!showCount}>
          {problem === 'over' && (
            <span className="field-error" role="alert">
              {t('other.over', { n: over })}
            </span>
          )}
          <span className="n" data-over={over > 0 || undefined} aria-live="polite">
            {text.length} / {FREE_TEXT_MAX}
          </span>
        </div>
      </div>
      <button type="button" className="send" aria-label={t('chat.send')} onClick={send} disabled={disabled || problem !== null}>
        <Icon name="send" />
      </button>
    </div>
  );
}
