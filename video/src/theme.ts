import { staticFile } from 'remotion';

export const C = {
  navy: '#0b1f3a', navy2: '#12305a', primary: '#2150d8', sky: '#7aa2ff', teal: '#0b8f83', mint: '#5fe0cf',
  amber: '#f4b14a', red: '#ff6b5e', ink: '#0f172a', paper: '#f6f8fb', white: '#ffffff',
};
export const FONT = '"Inter", "SF Pro Display", -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Drop your real UI pictures into video/public/screens/ and put the file names here.
 * Leave a value as null to show a labelled placeholder instead.
 */
export const SCREENSHOTS: Record<'tell' | 'timeline' | 'officer', string | null> = {
  tell: null,       // e.g. 'screens/tell.png'     (the "Tell us what happened" screen)
  timeline: null,   // e.g. 'screens/timeline.png' (the AI timeline / "Check your story")
  officer: null,    // e.g. 'screens/officer.png'  (the officer's similar-cases panel)
};
export const shot = (key: keyof typeof SCREENSHOTS) => (SCREENSHOTS[key] ? staticFile(SCREENSHOTS[key]!) : null);
