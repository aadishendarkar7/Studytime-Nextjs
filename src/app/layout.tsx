import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/plus-jakarta-sans';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Studytime — AI study companion', template: '%s · Studytime' },
  description: 'Focus timer, planner, AI tutor, flashcards with spaced repetition, and study groups.',
  applicationName: 'Studytime',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1714' },
  ],
};

// Applies the saved theme and accent color before the first paint (no flash).
const THEME_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('studytime:profile')||'null');var s=p&&p.state;if(!s){var o=JSON.parse(localStorage.getItem('studytime-v1')||'null');s=o}if(s){if(s.theme==='dark')document.documentElement.dataset.theme='dark';if(/^#[0-9a-f]{6}$/i.test(s.accent||''))document.documentElement.style.setProperty('--accent',s.accent)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
