import { CheckIcon } from './icons';

export type Step = 1 | 2 | 3 | 4;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Tell us' }, { n: 2, label: 'Questions' }, { n: 3, label: 'Check' }, { n: 4, label: 'Send' },
];

/** Slim progress bar. Steps you have already reached can be tapped to go back (or forward again). Nothing is lost either way. */
export function Stepper({ current, reached, onGo }: { current: Step; reached: Step; onGo: (n: Step) => void }) {
  return (
    <nav className="v-stepper" aria-label="Your progress">
      <ol>
        {STEPS.map((s) => {
          const done = s.n < current || (s.n <= reached && s.n !== current);
          const body = (
            <>
              <span className="v-step-dot" aria-hidden="true">{done ? <CheckIcon size={14} /> : s.n}</span>
              <span className="v-step-label">{s.label}</span>
            </>
          );
          return (
            <li key={s.n} className={`v-step-item${s.n === current ? ' is-current' : ''}${done ? ' is-done' : ''}`}>
              {s.n === current ? (
                <span className="v-step-btn" aria-current="step"><span className="sr-only">Step {s.n} of 4: </span>{body}</span>
              ) : done ? (
                <button type="button" className="v-step-btn" onClick={() => onGo(s.n)}>
                  <span className="sr-only">Go to step {s.n} of 4: </span>{body}
                </button>
              ) : (
                <span className="v-step-btn"><span className="sr-only">Step {s.n} of 4, not reached yet: </span>{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
