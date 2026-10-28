import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/inter';
import 'katex/dist/katex.min.css';
import './globals.css';
import { APPEARANCE_SCRIPT } from '@/lib/appearance';

export const metadata: Metadata = {
  title: { default: 'Studytime | Focus timer, planner and AI tutor', template: '%s | Studytime' },
  description: 'Drop where you are studying and friends can join you. Plus a focus timer with ambient sounds, a calendar that plans study time, an AI tutor and flashcards.',
  applicationName: 'Studytime',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-backdrop="plain" data-wash="soft" data-theme="light" data-font="sans" data-corners="soft" suppressHydrationWarning>
      <head>
        {/* Applies the saved colors and backdrop before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
