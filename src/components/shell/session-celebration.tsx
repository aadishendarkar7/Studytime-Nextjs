'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { Icon } from '@/components/ui/icons';
import { fmtMinutes } from '@/lib/utils';

interface Info { minutes: number; subject: string; points: number; bonus: boolean; onDone?: () => void }

export const useCelebration = create<{ info: Info | null; show: (info: Info) => void; hide: () => void }>()((set, get) => ({
  info: null,
  show: (info) => set({ info }),
  hide: () => {
    const done = get().info?.onDone;
    set({ info: null });
    done?.();
  },
}));

/** A burst of confetti from the middle of the screen, drawn on a canvas. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    g.scale(dpr, dpr);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f5bd3';
    const colors = [accent, '#f59e0b', '#10b981', '#ec4899', '#38bdf8', '#a78bfa'];
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 6 + Math.random() * 10;
      return { x: innerWidth / 2, y: innerHeight * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: colors[Math.floor(Math.random() * colors.length)] };
    });
    let frame = 0;
    let id = 0;
    const draw = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        g.save();
        g.globalAlpha = Math.max(0, 1 - frame / 170);
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.color;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      if (++frame < 170) id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 size-full" aria-hidden="true" />;
}

/** Shown for a few seconds when a focus session finishes. Click or press any key to close it. */
export function SessionCelebration() {
  const { info, hide } = useCelebration();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(hide, 4200);
    const key = () => hide();
    window.addEventListener('keydown', key);
    return () => (clearTimeout(t), window.removeEventListener('keydown', key));
  }, [info, hide]);
  return (
    <AnimatePresence>
      {info && (
        <motion.div
          key="celebrate"
          role="status"
          aria-live="polite"
          onClick={hide}
          className="fixed inset-0 z-[1000] grid cursor-pointer place-items-center bg-bg/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {!reduce && <Confetti />}
          <motion.div
            className="relative mx-4 flex max-w-sm flex-col items-center rounded-3xl border border-line bg-surface px-8 py-7 text-center shadow-2xl"
            initial={reduce ? { opacity: 0 } : { scale: 0.6, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <motion.span
              className="grid size-16 place-items-center rounded-full bg-ok text-white"
              initial={reduce ? false : { scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
            >
              <Icon name="check" className="size-9" />
            </motion.span>
            <p className="mt-4 text-[14px] font-semibold text-muted">Session complete</p>
            <p className="tnum mt-1 font-display text-[40px] leading-[44px] font-semibold tracking-tight">{fmtMinutes(info.minutes)}</p>
            <p className="mt-1 text-[15px] text-ink-2">{info.subject ? `of ${info.subject}` : 'of focused study'}</p>
            <motion.p
              className="mt-4 rounded-full bg-accent-soft px-3 py-1 text-[14px] font-semibold text-accent-ink"
              initial={reduce ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              +{info.points} points{info.bonus ? ', daily goal bonus' : ''}
            </motion.p>
            <p className="mt-4 text-[12px] text-muted">Tap anywhere to continue</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
