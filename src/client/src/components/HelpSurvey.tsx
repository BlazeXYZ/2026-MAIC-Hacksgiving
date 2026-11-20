import { useState } from 'react';
import { Car, Coffee, MessageCircle, MoreHorizontal, Shield, Utensils } from 'lucide-react';
import './HelpSurvey.css';

const NEEDS = [
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'ride', label: 'Ride', icon: Car },
  { id: 'safe-place', label: 'Safe Place', icon: Shield },
  { id: 'warm-lobby', label: 'Warm Lobby', icon: Coffee },
  { id: 'talk', label: 'Talk to Someone', icon: MessageCircle },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
] as const;

type NeedId = (typeof NEEDS)[number]['id'];

export default function HelpSurvey() {
  const [needId, setNeedId] = useState<NeedId | null>(null);
  const [description, setDescription] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const need = NEEDS.find((choice) => choice.id === needId);

  return (
    <section className="help-survey" aria-labelledby="survey-heading">
      <h2 id="survey-heading">What kind of help do you need?</h2>
      <p>This is a demo. Use sample details.</p>
      {reviewing && need ? (
        <section className="help-survey-review" aria-labelledby="survey-review-title">
          <h3 id="survey-review-title" tabIndex={-1} ref={(heading) => heading?.focus()}>
            Review your selection
          </h3>
          <p>{need.label}</p>
          {needId === 'other' && <p>{description.trim()}</p>}
          <button className="help-survey-action" type="button" onClick={() => setReviewing(false)}>
            Back to choices
          </button>
        </section>
      ) : (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (needId && (needId !== 'other' || description.trim())) setReviewing(true);
        }}>
          <fieldset>
            <legend>Choose one option</legend>
            <div className="help-survey-choices">
              {NEEDS.map(({ id, label, icon: Icon }) => (
                <label key={id} className="help-survey-choice">
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                  <input
                    type="radio"
                    name="need"
                    value={id}
                    checked={needId === id}
                    autoFocus={needId === id}
                    onChange={() => setNeedId(id)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          {needId === 'other' && (
            <label className="help-survey-description">
              Tell us what kind of help you need
              <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          )}
          <button className="help-survey-action" type="submit" disabled={!needId || (needId === 'other' && !description.trim())}>
            Next
          </button>
        </form>
      )}
    </section>
  );
}
