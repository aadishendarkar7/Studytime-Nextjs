export type Backdrop = 'contours' | 'waves' | 'grid' | 'dots' | 'diagonal' | 'plain';
export type Wash = 'none' | 'soft' | 'medium' | 'strong';
export type ThemeMode = 'night' | 'light' | 'dark' | 'system';
export type FontStyle = 'serif' | 'sans';
export type Corners = 'crisp' | 'soft' | 'round';

export const BACKDROPS: { value: Backdrop; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'contours', label: 'Contours' },
  { value: 'waves', label: 'Waves' },
  { value: 'grid', label: 'Graph paper' },
  { value: 'dots', label: 'Dots' },
  { value: 'diagonal', label: 'Lines' },
];

export const WASHES: { value: Wash; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
];

/** Named color pairs: the accent, then the second color of the background wash. */
export const PALETTES: { name: string; mood: string; accent: string; glow: string }[] = [
  { name: 'Lamplight', mood: 'Late night, desk lamp on', accent: '#2f6b4f', glow: '#f4b553' },
  { name: 'Cobalt', mood: 'Calm focus', accent: '#2f5bd3', glow: '#9db4f0' },
  { name: 'Graphite', mood: 'Quiet and serious', accent: '#3f3f46', glow: '#c4c4cc' },
  { name: 'Clay', mood: 'Warm desk lamp', accent: '#b4532a', glow: '#e7b76a' },
  { name: 'Sage', mood: 'Library garden', accent: '#4f7a5a', glow: '#d6c98f' },
  { name: 'Harbor', mood: 'Sea breeze', accent: '#2f5f8a', glow: '#9cc7c9' },
  { name: 'Rose', mood: 'Soft and bright', accent: '#b04a5a', glow: '#eab49c' },
  { name: 'Moss', mood: 'Forest trail', accent: '#5f6b2e', glow: '#c8b27a' },
  { name: 'Slate', mood: 'Rainy day', accent: '#46525e', glow: '#b9c4c9' },
  { name: 'Ocean', mood: 'Deep water', accent: '#1f6f78', glow: '#8fd0c4' },
  { name: 'Plum', mood: 'Late night', accent: '#7a4a6e', glow: '#d9b3c4' },
  { name: 'Ember', mood: 'Campfire', accent: '#c2410c', glow: '#f2c46d' },
  { name: 'Forest', mood: 'Pine woods', accent: '#2f5d3a', glow: '#a9c99a' },
  { name: 'Berry', mood: 'Bold and sweet', accent: '#9b2c4e', glow: '#f0a3a8' },
  { name: 'Denim', mood: 'Weekend jeans', accent: '#3b5b92', glow: '#c6b8e0' },
  { name: 'Sand', mood: 'Old paper', accent: '#8a6a3a', glow: '#ead9b5' },
];

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export interface AppearanceInput { accent: string; glow: string; backdrop: string; wash: string; theme: string; font: string; corners: string }

/**
 * Writes the user's appearance onto <html>. It has no imports and no outside
 * references so it can also run as an inline script before first paint.
 * --accent-ink is the accent adjusted until it reads at 4.5:1 on the card
 * surface of the current theme (darkened in light mode, lightened in dark).
 * --accent-fill is the accent when white text reads on it, otherwise a darker shade.
 */
export function applyAppearance(o: AppearanceInput) {
  const root = document.documentElement;
  const rgb = function (h: string) {
    return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  };
  const lum = function (c: number[]) {
    const v = c.map(function (x) { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = function (a: number, b: number) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const hex = function (c: number[]) { return '#' + c.map(function (x) { return Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0'); }).join(''); };
  const valid = function (v: string) { return /^#[0-9a-f]{6}$/i.test(v); };
  const accent = valid(o.accent) ? o.accent : '#2f5bd3';
  const glow = valid(o.glow) ? o.glow : '#9db4f0';
  const night = o.theme === 'night' || !o.theme;
  const dark = night || o.theme === 'dark' || (o.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const c = rgb(accent);

  let darker = c;
  for (let k = 0; k < 24 && ratio(lum(darker), lum([255, 255, 255])) < 4.6; k++) darker = darker.map(function (x) { return x * 0.92; });
  let lighter = c;
  const base = night ? [20, 27, 54] : [20, 20, 23];
  for (let k = 0; k < 24 && ratio(lum(lighter), lum(base)) < 4.8; k++) lighter = lighter.map(function (x) { return x + (255 - x) * 0.12; });

  root.dataset.theme = night ? 'night' : dark ? 'dark' : 'light';
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', hex(dark ? lighter : darker));
  root.style.setProperty('--accent-fill', ratio(lum(c), 1) >= 4.5 ? accent : hex(darker));
  root.style.setProperty('--glow', glow);
  root.dataset.backdrop = ['contours', 'waves', 'grid', 'dots', 'diagonal', 'plain'].indexOf(o.backdrop) >= 0 ? o.backdrop : 'plain';
  root.dataset.wash = ['none', 'soft', 'medium', 'strong'].indexOf(o.wash) >= 0 ? o.wash : 'soft';
  root.dataset.font = o.font === 'serif' ? 'serif' : 'sans';
  root.dataset.corners = ['crisp', 'soft', 'round'].indexOf(o.corners) >= 0 ? o.corners : 'soft';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', night ? '#0d1226' : dark ? '#09090b' : '#ffffff');
}

/** Inline script for layout.tsx: reads the saved profile and applies it before paint. */
export const APPEARANCE_SCRIPT = `try{var s=(JSON.parse(localStorage.getItem('studytime:profile')||'null')||{}).state||{};if(s.look!==4)s={theme:'night',accent:'#2f6b4f',glow:'#f4b553',wash:'soft'};(${applyAppearance.toString()})({accent:s.accent||'#2f6b4f',glow:s.glow||'#f4b553',backdrop:s.backdrop||'',wash:s.wash||'',theme:s.theme||'night',font:s.font||'',corners:s.corners||''})}catch(e){}`;
