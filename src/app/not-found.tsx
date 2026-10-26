import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-bold tracking-widest text-muted">404</p>
        <h1 className="mt-2 text-3xl font-extrabold">This page doesn’t exist</h1>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Back to Studytime</Link>
      </div>
    </main>
  );
}
