'use client';
import { useState } from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

/** Bumped when you change your own picture, so every avatar on screen reloads it. */
export const useAvatarVersion = create<{ v: Record<string, number>; bump: (id: string) => void }>()((set) => ({
  v: {},
  bump: (id) => set((s) => ({ v: { ...s.v, [id]: Date.now() } })),
}));
/** People with no picture, so their initial shows without asking the server again. */
const missing = new Set<string>();

/** A round picture, or their initial when they have none, with an optional presence dot. */
export function Avatar({ name, color, size = 32, online, className, userId }: { name: string; color?: string; size?: number; online?: boolean; className?: string; userId?: string }) {
  const version = useAvatarVersion((s) => (userId ? s.v[userId] : undefined));
  const key = userId ? `${userId}:${version ?? 0}` : '';
  const [failed, setFailed] = useState<string | null>(null);
  const showImg = !!userId && failed !== key && !(missing.has(userId) && !version);
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', !color && 'bg-surface-3 text-ink-2', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: color }} aria-hidden="true">
      {(name.trim()[0] || '?').toUpperCase()}
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatar/${encodeURIComponent(userId)}${version ? `?v=${version}` : ''}`}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full rounded-full object-cover"
          onError={() => {
            missing.add(userId);
            setFailed(key);
          }}
        />
      )}
      {online !== undefined && <span className={cn('absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-surface', online ? 'bg-ok' : 'bg-line-strong')} style={{ width: Math.max(9, size * 0.32), height: Math.max(9, size * 0.32) }} />}
    </span>
  );
}
