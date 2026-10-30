'use client';
import { useEffect } from 'react';

/**
 * Lights the edge of whichever panel the pointer is over, right where the pointer is.
 * One listener for the whole app; nothing runs on touch screens.
 */
export function PanelLight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let lit: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.panel') ?? null;
      if (lit && lit !== el) lit.removeAttribute('data-lit');
      lit = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.setAttribute('data-lit', '');
    };
    const move = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => lit?.removeAttribute('data-lit');
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      leave();
    };
  }, []);
  return null;
}
