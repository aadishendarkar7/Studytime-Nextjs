import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/icons';
import { LEGAL } from '@/lib/legal';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const missing = [!LEGAL.operatorName && 'operator name', !LEGAL.contactEmail && 'contact email', !LEGAL.governingLaw && 'governing law'].filter(Boolean);
  return (
    <div className="mx-auto min-h-dvh max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-10">
      <header className="flex h-16 items-center justify-between border-b border-line">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
          <Logo className="size-6" /> Studytime
        </Link>
        <Link href="/" className="text-[13px] text-accent underline underline-offset-4">Back to the app</Link>
      </header>
      <main className="mt-10 max-w-[68ch]">
        <h1 className="text-[30px] leading-9 max-sm:text-[26px] max-sm:leading-8">{title}</h1>
        <p className="tnum mt-2 text-[13px] text-muted">Last updated {LEGAL.updated}</p>
        {missing.length > 0 && (
          <p role="note" className="mt-6 border border-danger bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger rounded-xl">
            Not ready to publish. Missing: {missing.join(', ')}. Set them in src/lib/legal.ts.
          </p>
        )}
        <div className="mt-8 space-y-8">{children}</div>
        <nav aria-label="Legal" className="mt-12 flex gap-6 border-t border-line pt-4 text-[13px]">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-accent">Privacy policy</Link>
          <Link href="/terms" className="underline underline-offset-4 hover:text-accent">Terms and conditions</Link>
        </nav>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="border-b border-line pb-2 text-[24px] leading-8 font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-[14px] leading-6 [&_li]:ml-5 [&_li]:list-square [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

export function Operator() {
  return <>{LEGAL.operatorName || '[operator name]'}</>;
}

export function Contact() {
  return LEGAL.contactEmail ? <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent underline underline-offset-4">{LEGAL.contactEmail}</a> : <>[contact email]</>;
}
