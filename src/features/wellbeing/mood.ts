/** Mood colors, from muted to the user's accent, mixed in CSS so they follow the chosen theme. */
export const MOOD_FILL: Record<number, string> = {
  1: '#a69a8e',
  2: 'color-mix(in oklab, var(--glow) 55%, #a69a8e)',
  3: 'var(--glow)',
  4: 'color-mix(in oklab, var(--accent) 50%, var(--glow))',
  5: 'var(--accent)',
};
export const NO_MOOD = 'color-mix(in oklab, var(--ink) 12%, var(--surface))';
