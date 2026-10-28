'use client';
import { DEFAULT_PET, useExtras, type PetBody } from '@/lib/stores/extras';
import type { Mood } from './logic';

/** The tree at each stage. Decorations you own appear once the tree is big enough to hold them. */
export function TreeArt({ stage, decor }: { stage: number; decor: string[] }) {
  const has = (id: string) => decor.includes(id) && stage >= 4;
  const trunkH = [0, 18, 34, 56, 80, 100, 116, 128, 136][stage];
  const trunkW = [0, 3, 5, 9, 13, 17, 21, 25, 29][stage];
  const crown = [0, 0, 22, 38, 54, 70, 84, 96, 106][stage];
  const ground = 250;
  const top = ground - trunkH;
  const leaf = 'var(--ok)';
  return (
    <svg viewBox="0 0 320 270" className="h-full w-full" role="img" aria-label={`Your tree, stage ${stage + 1} of 9`}>
      <ellipse cx="160" cy={ground + 4} rx="120" ry="12" fill="#000" opacity="0.1" />
      {has('moon') && <path d="M268 40a24 24 0 1 0 14 40 20 20 0 1 1-14-40z" fill="#e8c46a" />}
      {stage === 0 ? (
        <>
          <ellipse cx="160" cy={ground - 2} rx="26" ry="8" fill="#8a6a4a" />
          <ellipse cx="160" cy={ground - 8} rx="7" ry="5" fill="#6b4a2f" />
        </>
      ) : (
        <g className="tree-sway" style={{ transformOrigin: `160px ${ground}px` }}>
          <path d={`M${160 - trunkW / 2} ${ground} C${160 - trunkW / 2} ${ground - trunkH * 0.5} ${160 - trunkW * 0.3} ${top + 10} 160 ${top} C${160 + trunkW * 0.3} ${top + 10} ${160 + trunkW / 2} ${ground - trunkH * 0.5} ${160 + trunkW / 2} ${ground} Z`} fill="#7a5a3c" />
          {stage === 1 && (
            <>
              <ellipse cx="150" cy={top + 2} rx="10" ry="5" fill={leaf} transform={`rotate(-30 150 ${top + 2})`} />
              <ellipse cx="170" cy={top + 2} rx="10" ry="5" fill={leaf} transform={`rotate(30 170 ${top + 2})`} />
            </>
          )}
          {stage >= 2 && (
            <g>
              {stage >= 5 && <path d={`M160 ${top + 30} L${120} ${top - 4} M160 ${top + 24} L${202} ${top - 2}`} stroke="#7a5a3c" strokeWidth={trunkW / 3} strokeLinecap="round" />}
              <circle cx="160" cy={top - crown * 0.35} r={crown} fill={leaf} opacity="0.9" />
              {stage >= 3 && <circle cx={160 - crown * 0.75} cy={top - crown * 0.05} r={crown * 0.7} fill={leaf} opacity="0.85" />}
              {stage >= 3 && <circle cx={160 + crown * 0.75} cy={top - crown * 0.05} r={crown * 0.7} fill={leaf} opacity="0.85" />}
              {stage >= 6 && <circle cx="160" cy={top - crown * 1.05} r={crown * 0.6} fill={leaf} opacity="0.95" />}
              {has('blossoms') && [[-40, -30], [30, -50], [55, 0], [-60, 5], [0, -80], [15, -15]].map(([dx, dy], i) => <circle key={i} cx={160 + dx * crown / 70} cy={top + dy * crown / 70} r="5" fill="#f2a7bf" />)}
              {has('fruit') && [[-30, 0], [35, -20], [5, -45], [-50, -35]].map(([dx, dy], i) => <circle key={i} cx={160 + dx * crown / 70} cy={top + dy * crown / 70} r="6" fill="#d9583b" />)}
              {has('lanterns') && [[-55, 20], [10, 25], [60, 18]].map(([dx, dy], i) => (
                <g key={i}><line x1={160 + dx} y1={top + dy - 14} x2={160 + dx} y2={top + dy} stroke="#7a5a3c" /><rect x={160 + dx - 6} y={top + dy} width="12" height="15" rx="4" fill="#e8a13a" /></g>
              ))}
              {has('fireflies') && [[-80, -10], [70, -60], [90, 10], [-20, -100], [40, -110]].map(([dx, dy], i) => <circle key={i} className="firefly" style={{ animationDelay: `${i * 0.6}s` }} cx={160 + dx} cy={top + dy} r="3" fill="#f5e27a" />)}
            </g>
          )}
        </g>
      )}
      {has('swing') && (
        <g><line x1="122" y1={top + 10} x2="118" y2={ground - 40} stroke="#8a7a68" strokeWidth="2" /><line x1="142" y1={top + 18} x2="140" y2={ground - 40} stroke="#8a7a68" strokeWidth="2" /><rect x="112" y={ground - 42} width="34" height="6" rx="2" fill="#7a5a3c" /></g>
      )}
      {has('birdhouse') && <g><rect x="166" y={ground - trunkH * 0.6} width="20" height="18" fill="#c98b4e" /><path d={`M163 ${ground - trunkH * 0.6} L176 ${ground - trunkH * 0.6 - 11} L189 ${ground - trunkH * 0.6} Z`} fill="#8a4b2a" /><circle cx="176" cy={ground - trunkH * 0.6 + 8} r="3" fill="#3a2a1a" /></g>}
      {has('birds') && <g fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"><path d="M60 70 q6 -6 12 0 q6 -6 12 0" /><path d="M240 100 q5 -5 10 0 q5 -5 10 0" /></g>}
    </svg>
  );
}

export type PetStage = 'egg' | 'baby' | 'kid' | 'grown';
export const petStage = (sessions: number): PetStage => (sessions < 1 ? 'egg' : sessions < 5 ? 'baby' : sessions < 25 ? 'kid' : 'grown');
export const STAGE_NAME: Record<PetStage, string> = { egg: 'Egg', baby: 'Hatchling', kid: 'Kid', grown: 'Grown up' };

/** Mix a hex color toward white (t > 0) or black (t < 0). */
export function shade(hex: string, t: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Your pet. It hatches after your first session and grows with you.
 * `look` moves the pupils toward the pointer (-1 to 1 each way).
 * `body` overrides the saved appearance, for the customize preview.
 */
export function PetArt({ mood, wear, stage = 'kid', look = { x: 0, y: 0 }, asleep = false, reading = false, body }: { mood: Mood; wear: string; stage?: PetStage; look?: { x: number; y: number }; asleep?: boolean; reading?: boolean; body?: PetBody }) {
  const saved = useExtras((s) => s.petBody);
  const b = body ?? saved ?? DEFAULT_PET;
  const fur = b.fur;
  const dark = shade(fur, -0.18);
  const belly = shade(fur, 0.45);
  const inner = shade(fur, 0.25);
  if (stage === 'egg')
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="An egg, waiting to hatch">
        <ellipse cx="100" cy="176" rx="46" ry="8" fill="#000" opacity="0.1" />
        <g className="egg-wobble" style={{ transformOrigin: '100px 172px' }}>
          <path d="M100 44 C140 44 156 104 156 128 C156 158 132 174 100 174 C68 174 44 158 44 128 C44 104 60 44 100 44 Z" fill="#f6efe3" stroke="#e2d5bf" strokeWidth="3" />
          <path d="M62 120 l14 -10 l12 10 l12 -10 l12 10 l12 -10 l14 10" fill="none" stroke={fur} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="82" cy="86" r="6" fill={fur} opacity="0.7" /><circle cx="122" cy="146" r="8" fill={fur} opacity="0.6" />
        </g>
      </svg>
    );
  const k = stage === 'baby' ? 0.78 : stage === 'kid' ? 0.9 : 1;
  const px = look.x * 3;
  const py = look.y * 2.5;
  const closed = asleep || mood === 'sleepy';
  const r = b.eyes === 'sparkle' ? 8.5 : b.eyes === 'dot' ? 4.5 : mood === 'missing' ? 5.5 : 6.5;
  const eyes = closed ? (
    <g stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" fill="none"><path d="M72 104 q8 5 16 0" /><path d="M112 104 q8 5 16 0" /></g>
  ) : (
    <g fill="#1f1a17">
      <circle cx={80 + px} cy={102 + py} r={r} />
      <circle cx={120 + px} cy={102 + py} r={r} />
      {b.eyes !== 'dot' && <><circle cx={82 + px} cy={99 + py} r={b.eyes === 'sparkle' ? 3 : 2} fill="#fff" /><circle cx={122 + px} cy={99 + py} r={b.eyes === 'sparkle' ? 3 : 2} fill="#fff" /></>}
      {b.eyes === 'sparkle' && <><circle cx={77 + px} cy={106 + py} r="1.4" fill="#fff" /><circle cx={117 + px} cy={106 + py} r="1.4" fill="#fff" /></>}
    </g>
  );
  const mouth = asleep ? <ellipse cx="100" cy="121" rx="4" ry="3" fill="#1f1a17" /> : mood === 'thriving' ? <path d="M88 118 q12 14 24 0" fill="#1f1a17" /> : mood === 'happy' ? <path d="M90 118 q10 9 20 0" fill="none" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" /> : mood === 'sleepy' ? <ellipse cx="100" cy="121" rx="5" ry="4" fill="#1f1a17" /> : <path d="M90 124 q10 -7 20 0" fill="none" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" />;
  const ears = {
    cat: <g><path d="M62 66 L56 34 L86 56 Z" fill={dark} /><path d="M138 66 L144 34 L114 56 Z" fill={dark} /><path d="M65 60 L61 42 L78 55 Z" fill={inner} /><path d="M135 60 L139 42 L122 55 Z" fill={inner} /></g>,
    bunny: <g><ellipse cx="76" cy="34" rx="12" ry="32" fill={dark} transform="rotate(-12 76 34)" /><ellipse cx="124" cy="34" rx="12" ry="32" fill={dark} transform="rotate(12 124 34)" /><ellipse cx="76" cy="36" rx="6" ry="22" fill={inner} transform="rotate(-12 76 36)" /><ellipse cx="124" cy="36" rx="6" ry="22" fill={inner} transform="rotate(12 124 36)" /></g>,
    bear: <g><circle cx="58" cy="62" r="17" fill={dark} /><circle cx="142" cy="62" r="17" fill={dark} /><circle cx="58" cy="62" r="9" fill={inner} /><circle cx="142" cy="62" r="9" fill={inner} /></g>,
    pup: null,
    blob: <g><path d="M100 54 q-2 -16 6 -24" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" /><ellipse cx="112" cy="28" rx="10" ry="6" fill="#7cc46a" transform="rotate(-25 112 28)" /></g>,
  }[b.species];
  const tail = stage !== 'grown' ? null : {
    cat: <path d="M160 150 q30 -6 26 -34 q-2 -10 -10 -6 q4 20 -18 26" fill={dark} />,
    bunny: <circle cx="164" cy="152" r="12" fill={belly} />,
    bear: <circle cx="162" cy="150" r="9" fill={dark} />,
    pup: <path d="M160 146 q22 -4 26 -26" fill="none" stroke={dark} strokeWidth="9" strokeLinecap="round" />,
    blob: null,
  }[b.species];
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible" role="img" aria-label={`Your pet looks ${asleep ? 'asleep' : mood}`}>
      <ellipse cx="100" cy="176" rx={58 * k} ry="9" fill="#000" opacity="0.1" />
      <g transform={`translate(${100 - 100 * k} ${176 - 176 * k}) scale(${k})`}>
        <g className={mood === 'thriving' && !asleep ? 'pet-bounce' : 'pet-breathe'} style={{ transformOrigin: '100px 170px' }}>
          {tail}
          {ears}
          <path d={b.species === 'blob' ? 'M100 56 C146 56 170 100 168 130 C166 160 136 172 100 172 C64 172 34 160 32 130 C30 100 54 56 100 56 Z' : 'M100 52 C150 52 168 90 166 122 C164 156 136 172 100 172 C64 172 36 156 34 122 C32 90 50 52 100 52 Z'} fill={fur} />
          {b.species === 'pup' && <g fill={dark}><ellipse cx="42" cy="98" rx="15" ry="32" transform="rotate(18 42 98)" /><ellipse cx="158" cy="98" rx="15" ry="32" transform="rotate(-18 158 98)" /></g>}
          {b.marking === 'spots' && <g fill={dark}><circle cx="62" cy="80" r="9" /><circle cx="140" cy="140" r="11" /><circle cx="148" cy="88" r="6" /></g>}
          {b.marking === 'stripe' && <path d="M92 54 Q100 50 108 54 L104 84 Q100 88 96 84 Z" fill={dark} />}
          {b.marking === 'patch' && <ellipse cx="120" cy="100" rx="19" ry="17" fill={dark} />}
          <ellipse cx="100" cy="140" rx="34" ry="24" fill={belly} />
          {b.blush && <><circle cx="68" cy="120" r="8" fill="#f09a8a" opacity="0.5" /><circle cx="132" cy="120" r="8" fill="#f09a8a" opacity="0.5" /></>}
          {eyes}
          {(b.species === 'bear' || b.species === 'pup') && <ellipse cx="100" cy="111" rx="5" ry="3.5" fill="#1f1a17" />}
          {mouth}
          {wear === 'glasses' && <g fill="none" stroke="#1f1a17" strokeWidth="3"><circle cx="80" cy="102" r="13" /><circle cx="120" cy="102" r="13" /><path d="M93 102 h14" /></g>}
          {wear === 'scarf' && <g><path d="M48 150 Q100 170 152 150 L150 162 Q100 182 50 162 Z" fill="#c2413a" /><rect x="120" y="158" width="14" height="26" rx="4" fill="#c2413a" /></g>}
          {wear === 'beanie' && <g><path d="M52 74 C60 30 140 30 148 74 Z" fill="var(--accent)" /><rect x="50" y="68" width="100" height="12" rx="6" fill="var(--accent-fill)" /><circle cx="100" cy="32" r="9" fill="#e9eef5" /></g>}
          {wear === 'bow' && <g fill="#e4628a"><path d="M118 56 L104 46 L104 66 Z" /><path d="M118 56 L132 46 L132 66 Z" /><circle cx="118" cy="56" r="5" /></g>}
          {wear === 'headphones' && <g><path d="M44 104 C44 40 156 40 156 104" fill="none" stroke="#27272a" strokeWidth="7" /><rect x="34" y="96" width="18" height="30" rx="8" fill="#27272a" /><rect x="148" y="96" width="18" height="30" rx="8" fill="#27272a" /></g>}
          {wear === 'gradcap' && <g><path d="M100 30 L160 50 L100 70 L40 50 Z" fill="#18181b" /><rect x="74" y="56" width="52" height="16" fill="#18181b" /><path d="M150 52 L152 82" stroke="#e8c46a" strokeWidth="3" /><circle cx="152" cy="84" r="4" fill="#e8c46a" /></g>}
          {reading && <g><path d="M62 150 L100 158 L138 150 L138 176 L100 184 L62 176 Z" fill="var(--accent-fill)" /><path d="M100 158 L100 184" stroke="#fff" strokeWidth="2" /><path d="M70 160 l22 4 M108 164 l22 -4" stroke="#fff" strokeWidth="1.5" opacity="0.7" /></g>}
        </g>
      </g>
    </svg>
  );
}
