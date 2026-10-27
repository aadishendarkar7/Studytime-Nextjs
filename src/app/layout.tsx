import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/figtree';
import 'katex/dist/katex.min.css';
import './globals.css';
import { APPEARANCE_SCRIPT } from '@/lib/appearance';

export const metadata: Metadata = {
  title: { default: 'Studytime | Focus timer, planner and AI tutor', template: '%s | Studytime' },
  description: 'Focus timer with ambient sounds, deadline planner, AI tutor, grade and GPA calculators, flashcards, study partners and study spots.',
  applicationName: 'Studytime',
};

export const viewport: Viewport = {
  themeColor: '#f8f2e8',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-backdrop="contours" data-wash="medium" suppressHydrationWarning>
      <head>
        {/* Applies the saved colors and backdrop before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
