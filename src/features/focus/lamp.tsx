'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useProfile } from '@/lib/stores/profile';

// WebGL only loads in the browser, after the page is up.
const LightRays = dynamic(() => import('@/components/bits/LightRays'), { ssr: false });

/** A desk lamp over the timer. Dim while you set up, brighter once a session is running. */
export function Lamp({ on }: { on: boolean }) {
  const glow = useProfile((s) => s.glow) || '#f4b553';
  const theme = useProfile((s) => s.theme);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    // Skip it for people who asked for less motion, and on browsers without WebGL.
    const t = setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const gl = !!document.createElement('canvas').getContext('webgl');
      setOk(!reduce && gl);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (!ok) return null;
  const light = theme === 'light';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-[1500ms]" style={{ opacity: on ? 1 : 0.55 }}>
      <LightRays
        raysOrigin="top-center"
        raysColor={glow}
        raysSpeed={on ? 0.6 : 0.3}
        lightSpread={0.9}
        rayLength={1.6}
        fadeDistance={0.9}
        intensity={light ? 0.6 : 0.9}
        glow={0.5}
        haze={0.3}
        followMouse={false}
        cursorShadow={false}
        clickPulse={false}
        lightMode={light}
        maxDevicePixelRatio={1.5}
      />
    </div>
  );
}
