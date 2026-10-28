'use client';
import { applyAppearance } from '@/lib/appearance';
import { useProfile, type ProfileData } from '@/lib/stores/profile';

type Look = Partial<Pick<ProfileData, 'accent' | 'glow' | 'theme' | 'wash' | 'backdrop' | 'font' | 'corners'>>;

/**
 * Applies a new look. Where the browser supports view transitions, the new
 * colors spread out in a circle from the click; otherwise they just switch.
 */
export function changeLook(patch: Look, from?: { clientX: number; clientY: number } | null) {
  const apply = () => {
    const p = { ...useProfile.getState(), ...patch };
    applyAppearance({ accent: p.accent, glow: p.glow, backdrop: p.backdrop, wash: p.wash, theme: p.theme, font: p.font, corners: p.corners });
    useProfile.getState().update(patch);
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();
  const root = document.documentElement;
  root.style.setProperty('--rx', from ? `${from.clientX}px` : '50%');
  root.style.setProperty('--ry', from ? `${from.clientY}px` : '0px');
  root.classList.add('color-ripple');
  doc.startViewTransition(apply).finished.finally(() => root.classList.remove('color-ripple'));
}
