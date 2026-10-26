'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Markdown } from '@/components/ui/markdown';
import { useUi } from '@/lib/stores/ui';

/** Renders a document into #print-root and opens the browser's print dialog (Save as PDF). */
export function PrintPortal() {
  const job = useUi((s) => s.printJob);
  const clear = useUi((s) => s.print);
  // Rendered only on the client (after the app shell hydrates), so document is available.
  const [root] = useState<HTMLElement>(() => {
    let el = document.getElementById('print-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'print-root';
      document.body.appendChild(el);
    }
    return el;
  });
  useEffect(() => {
    if (!job) return;
    const previous = document.title;
    document.title = job.title;
    const timer = setTimeout(() => {
      window.print();
      document.title = previous;
      clear(null);
    }, 150);
    return () => clearTimeout(timer);
  }, [job, clear]);
  if (!job) return null;
  return createPortal(
    <article>
      <h1 style={{ font: '700 22pt/1.2 Helvetica, Arial, sans-serif', margin: '0 0 4mm' }}>{job.title}</h1>
      <p style={{ font: '9pt Helvetica, Arial, sans-serif', color: '#62706a', margin: '0 0 6mm' }}>Studytime · {new Date().toLocaleDateString()}</p>
      <Markdown>{job.markdown}</Markdown>
    </article>,
    root,
  );
}
