import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[1200px] content-center px-6">
      <p className="tnum text-[12px] font-medium text-muted">Error 404</p>
      <h1 className="mt-2 text-[40px] leading-[44px] font-semibold">This page does not exist</h1>
      <p className="mt-2 max-w-[68ch] text-muted">The address may have changed, or it was typed wrong.</p>
      <Link href="/" className="mt-6 inline-flex h-11 w-fit items-center border border-brand bg-brand px-4 text-[14px] font-medium text-bg hover:bg-brand-hover rounded-xl">Go to Overview</Link>
    </main>
  );
}
