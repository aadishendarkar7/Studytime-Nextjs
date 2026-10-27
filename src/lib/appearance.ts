export type Backdrop = 'contours' | 'grid' | 'dots' | 'plain';
export type Wash = 'soft' | 'medium' | 'strong';

export const BACKDROPS: { value: Backdrop; label: string }[] = [
  { value: 'contours', label: 'Contour lines' },
  { value: 'grid', label: 'Graph paper' },
  { value: 'dots', label: 'Dot grid' },
  { value: 'plain', label: 'Plain' },
];

export const WASHES: { value: Wash; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
];

/** Named color pairs: the accent, then the second color of the background wash. */
export const PALETTES: { name: string; accent: string; glow: string }[] = [
  { name: 'Clay', accent: '#b4532a', glow: '#e7b76a' },
  { name: 'Sage', accent: '#4f7a5a', glow: '#d6c98f' },
  { name: 'Harbor', accent: '#2f5f8a', glow: '#9cc7c9' },
  { name: 'Rose', accent: '#b04a5a', glow: '#eab49c' },
  { name: 'Moss', accent: '#5f6b2e', glow: '#c8b27a' },
  { name: 'Slate', accent: '#46525e', glow: '#b9c4c9' },
];

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/**
 * Writes the user's colors onto <html>. It has no imports and no outside
 * references so it can also run as an inline script before first paint.
 * --accent-ink is the accent darkened until it reads at 4.5:1 on the card
 * surface. --accent-fill is the accent when white text reads on it at 4.5:1,
 * otherwise the darkened accent, so button labels can always be white.
 */
export function applyAppearance(accent: string, glow: string, backdrop: string, wash: string) {
  const root = document.documentElement;
  const rgb = function (h: string) {
    return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  };
  const lum = function (c: number[]) {
    const v = c.map(function (x) { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = function (a: number, b: number) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const hex = function (c: number[]) { return '#' + c.map(function (x) { return Math.round(x).toString(16).padStart(2, '0'); }).join(''); };
  if (!/^#[0-9a-f]{6}$/i.test(accent)) accent = '#b4532a';
  if (!/^#[0-9a-f]{6}$/i.test(glow)) glow = '#e7b76a';
  const surface = lum([255, 252, 247]);
  const c = rgb(accent);
  let ink = c;
  for (let k = 0; k < 20 && ratio(lum(ink), surface) < 4.6; k++) ink = ink.map(function (x) { return x * 0.92; });
  const fill = ratio(lum(c), 1) >= 4.5 ? accent : hex(ink);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', hex(ink));
  root.style.setProperty('--accent-fill', fill);
  root.style.setProperty('--glow', glow);
  root.dataset.backdrop = ['contours', 'grid', 'dots', 'plain'].indexOf(backdrop) >= 0 ? backdrop : 'contours';
  root.dataset.wash = ['soft', 'medium', 'strong'].indexOf(wash) >= 0 ? wash : 'medium';
}

/** Inline script for layout.tsx: reads the saved profile and applies it before paint. */
export const APPEARANCE_SCRIPT = `try{var s=(JSON.parse(localStorage.getItem('studytime:profile')||'null')||{}).state||{};(${applyAppearance.toString()})(s.accent||'',s.glow||'',s.backdrop||'',s.wash||'')}catch(e){}`;
