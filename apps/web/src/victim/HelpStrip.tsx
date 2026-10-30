import { AlertIcon } from './icons';

/** Urgent guidance. Always visible, never blocks anything. */
export function HelpStrip() {
  return (
    <aside className="v-help" aria-label="If you lost money just now">
      <AlertIcon size={18} />
      <p>
        <strong>Lost money in the last few hours?</strong>{' '}
        Call <a href="tel:1930" className="v-help-call">1930</a> now and tell your bank.{' '}
        <span className="v-help-more">For any cyber crime, report at <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.</span>
      </p>
    </aside>
  );
}
