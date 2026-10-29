'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Your logo, shown exactly as the image file in public/logo.png. Theme colors never touch it. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="" aria-hidden="true" draggable={false} onError={() => setMissing(true)} className={cn('shrink-0 object-contain', className)} />;
}
