'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { minutesOn } from '@/features/focus/logic';
import { Dialog } from '@/components/ui/dialog';
import { useAccount } from '@/features/auth/account';
import { DEFAULT_PET, useExtras, type PetBody } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes, todayKey } from '@/lib/utils';
import { PetArt, petStage, STAGE_NAME, TreeArt } from './art';
import { DUPLICATE_POINTS, isAsleep, ITEMS, packsEarned, petLines, petMood, rollItem, skyAt, treeStage, type Item, type Sky } from './logic';

const RARITY_STYLE = { common: 'bg-surface-3 text-ink-2', rare: 'bg-accent-soft text-accent-ink', epic: 'bg-warn-soft text-warn' } as const;
const SKY: Record<Sky, { bg: string; ground: string; hill: string }> = {
  dawn: { bg: 'linear-gradient(180deg, #f7cfae 0%, #f3dcc8 45%, #c9dcef 100%)', ground: '#7fb36a', hill: '#9cc68a' },
  day: { bg: 'linear-gradient(180deg, #8fc3f0 0%, #c4e0f7 60%, #e6f2fb 100%)', ground: '#72ad5e', hill: '#95c682' },
  dusk: { bg: 'linear-gradient(180deg, #5d5f9f 0%, #c77f86 55%, #f2b07f 100%)', ground: '#4f7f4a', hill: '#6d955f' },
  night: { bg: 'linear-gradient(180deg, #0c1530 0%, #1b2a55 70%, #2c3c6b 100%)', ground: '#24402d', hill: '#2f5139' },
};
const NEXT_STAGE = { egg: 1, baby: 5, kid: 25, grown: null } as const;

function random() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return [a[0] / 2 ** 32, a[1] / 2 ** 32] as const;
}

/** Everything the tree and the pet are counted from. */
export function useGarden() {
  const p = useProfile();
  const x = useExtras();
  const now = useNow(60_000);
  const total = p.sessions.reduce((n, s) => n + s.minutes, 0);
  const today = minutesOn(p.sessions, todayKey());
  const hour = new Date(now).getHours();
  const focusing = p.timer.mode === 'running';
  const mood = petMood({ today, goal: p.dailyGoal, lastSessionAt: p.sessions[0] ? new Date(p.sessions[0].at).getTime() : null, now });
  const stage = petStage(p.sessions.length);
  const sky = skyAt(hour);
  const asleep = stage !== 'egg' && isAsleep(hour, focusing);
  const glasses = x.water[todayKey()] ?? 0;
  // One bonus pack for every friend who joined from your invite link.
  const invites = useAccount((st) => st.user?.invites ?? 0);
  const lines = petLines({ name: x.petName, mood, egg: stage === 'egg', asleep, focusing, sky, today, goal: p.dailyGoal, glasses });
  return { p, x, total, today, tree: treeStage(total), mood, stage, sky, asleep, focusing, lines, packs: Math.max(0, packsEarned(total) + invites - x.packsOpened) };
}

/** The pet on its own, with a speech bubble. Tap it to hear more. Used on Home. */
export function PetCompanion({ className }: { className?: string }) {
  const g = useGarden();
  const [i, setI] = useState(0);
  const [hop, setHop] = useState(0);
  return (
    <button type="button" onClick={() => (setI((n) => n + 1), setHop((n) => n + 1))} className={cn('group flex items-end gap-2 text-left', className)} aria-label={`Talk to ${g.x.petName}`}>
      <span key={hop} className={cn('block size-16 shrink-0', hop > 0 && 'pet-hop')}><PetArt mood={g.mood} wear={g.x.petWear} stage={g.stage} asleep={g.asleep} reading={g.focusing} /></span>
      <span key={`b${i}`} className="bubble-in relative mb-6 max-w-[240px] rounded-xl rounded-bl-sm border border-line bg-surface px-3 py-2 text-[13px] leading-5 text-ink-2 shadow-sm">{g.lines[i % g.lines.length]}</span>
    </button>
  );
}

/** A small living scene: the sky follows the clock, it rains on the tree while you focus, and the pet watches your pointer. */
export function GardenPage() {
  const g = useGarden();
  const { x } = g;
  const scene = useRef<HTMLDivElement>(null);
  const petBox = useRef<HTMLButtonElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [line, setLine] = useState<string | null>(null);
  const [hop, setHop] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; dx: number }[]>([]);
  const [naming, setNaming] = useState(false);
  const [designing, setDesigning] = useState(false);
  const [name, setName] = useState(x.petName);
  const turn = useRef(0);
  const owned = ITEMS.filter((i) => x.inventory.includes(i.id));
  const colors = SKY[g.sky];
  const dark = g.sky === 'night' || g.sky === 'dusk';

  const say = (text?: string) => {
    setLine(text ?? g.lines[turn.current++ % g.lines.length]);
    setHop((n) => n + 1);
  };
  const love = () => {
    const id = Date.now();
    setHearts((h) => [...h.slice(-6), ...[0, 1, 2].map((k) => ({ id: id + k, dx: (k - 1) * 22 + Math.round(Math.random() * 10 - 5) }))]);
    setTimeout(() => setHearts((h) => h.filter((v) => v.id < id || v.id > id + 2)), 1300);
  };
  const follow = (e: React.PointerEvent) => {
    const r = petBox.current?.getBoundingClientRect();
    if (!r) return;
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    setLook({ x: clamp((e.clientX - (r.left + r.width / 2)) / 260), y: clamp((e.clientY - (r.top + r.height / 2)) / 200) });
  };

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div ref={scene} onPointerMove={follow} onPointerLeave={() => setLook({ x: 0, y: 0 })} className="relative h-[340px] select-none max-sm:h-[300px]" style={{ background: colors.bg }}>
          {/* Sun or moon, stars and clouds */}
          <svg viewBox="0 0 1000 340" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {g.sky === 'night' ? (
              <>
                {[[60, 40], [140, 90], [230, 30], [330, 70], [420, 24], [520, 60], [600, 110], [690, 36], [760, 86], [280, 130], [470, 120], [840, 130], [900, 40], [960, 100]].map(([cx, cy], i) => <circle key={i} className="star-twinkle" style={{ animationDelay: `${(i % 5) * 0.5}s` }} cx={cx} cy={cy} r={i % 3 ? 1.6 : 2.4} fill="#fff" />)}
                <path d="M840 60a34 34 0 1 0 22 60 28 28 0 1 1 -22 -60z" fill="#f4e7b5" />
              </>
            ) : (
              <circle cx={g.sky === 'dawn' ? 120 : g.sky === 'dusk' ? 880 : 820} cy={g.sky === 'day' ? 80 : 170} r="30" fill={g.sky === 'day' ? '#ffe28a' : '#ffc27a'} opacity="0.95" />
            )}
            {[0, 1, 2].map((i) => (
              <g key={i} className="cloud-drift" style={{ animationDelay: `${-i * 22}s`, animationDuration: `${60 + i * 18}s` }} opacity={dark ? 0.25 : 0.85}>
                <g transform={`translate(0 ${40 + i * 38})`} fill="#fff"><ellipse cx="40" cy="20" rx="34" ry="14" /><ellipse cx="70" cy="12" rx="24" ry="14" /><ellipse cx="96" cy="22" rx="28" ry="12" /></g>
              </g>
            ))}
            {g.focusing && (
              <g>
                <ellipse cx="300" cy="78" rx="110" ry="26" fill={dark ? '#6b7690' : '#c9d3df'} />
                <ellipse cx="250" cy="66" rx="60" ry="22" fill={dark ? '#7a85a0' : '#d8e0ea'} />
                {Array.from({ length: 18 }, (_, i) => <line key={i} className="rain-drop" style={{ animationDelay: `${(i * 0.13) % 0.9}s` }} x1={205 + i * 11} y1={100 + (i % 4) * 6} x2={202 + i * 11} y2={112 + (i % 4) * 6} stroke="#6aa5e6" strokeWidth="2" strokeLinecap="round" />)}
              </g>
            )}
            <ellipse cx="160" cy="330" rx="320" ry="70" fill={colors.hill} />
            <ellipse cx="820" cy="340" rx="360" ry="60" fill={colors.hill} />
            <rect x="0" y="292" width="1000" height="48" fill={colors.ground} />
          </svg>

          <div className="absolute bottom-[30px] left-[4%] h-[300px] w-[52%] max-w-[380px] max-sm:h-[250px] max-sm:w-[60%]"><TreeArt stage={g.tree.stage} decor={x.inventory} /></div>

          <div className="absolute right-[8%] bottom-[34px] w-[170px] max-sm:right-[3%] max-sm:w-[130px]">
            {line && <p key={line + hop} className="bubble-in absolute -top-14 right-2 left-[-30px] rounded-xl rounded-br-sm border border-line bg-surface px-3 py-2 text-[13px] leading-5 text-ink shadow-sm max-sm:-top-16">{line}</p>}
            {g.asleep && <span className="zzz absolute -top-2 right-6 font-semibold text-white/90" aria-hidden="true">z z</span>}
            {hearts.map((h) => (
              <svg key={h.id} viewBox="0 0 24 24" className="heart-float absolute top-6 size-5" style={{ left: `calc(50% + ${h.dx}px)` }} aria-hidden="true"><path d="M12 21s-7-4.4-9.3-9C1 8.5 3 5 6.5 5c2 0 3.5 1.2 4.4 2.6h2.2C14 6.2 15.5 5 17.5 5 21 5 23 8.5 21.3 12 19 16.6 12 21 12 21z" fill="#ef5a7a" /></svg>
            ))}
            <button ref={petBox} type="button" onClick={() => (say(), love())} aria-label={`Talk to ${x.petName}`} className="block aspect-square w-full cursor-pointer">
              <span key={hop} className={cn('block h-full w-full', hop > 0 && 'pet-hop')}><PetArt mood={g.mood} wear={x.petWear} stage={g.stage} look={look} asleep={g.asleep} reading={g.focusing} /></span>
            </button>
          </div>

          <p className={cn('absolute top-3 left-4 text-[12px] font-medium', dark ? 'text-white/80' : 'text-ink/70')}>
            {g.focusing ? 'Raining on your tree while you focus' : g.asleep ? `${x.petName} is asleep. Tap to wake.` : `Tap ${x.petName}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Button size="sm" variant="secondary" onClick={() => (say(g.stage === 'egg' ? undefined : `Thanks. Your turn: ${['shoulders down', 'unclench your jaw', 'sit up a bit', 'look away from the screen for 20 seconds'][Math.floor(Math.random() * 4)]}.`), love())}><Icon name="heart" className="size-4" /> Pet</Button>
          <Button size="sm" variant="secondary" onClick={() => setDesigning(true)}><Icon name="palette" className="size-4" /> Customize</Button>
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">Wearing</span>
            <Select aria-label="Pet outfit" className="h-8 w-40 text-[13px]" value={x.petWear} onChange={(e) => (x.update({ petWear: e.target.value }), say(e.target.value ? 'How do I look?' : 'Back to basics.'))}>
              <option value="">Nothing</option>
              {owned.filter((i) => i.kind === 'pet').map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Tree" value={g.tree.name} hint={g.tree.next ? `${fmtMinutes(g.tree.next.need)} of focus to ${g.tree.next.name}` : 'Fully grown'} frac={g.tree.next?.frac ?? 1} />
        <section className="rounded-xl border border-line bg-surface p-4">
          {naming ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); x.update({ petName: name.trim().slice(0, 20) || 'Pip' }); setNaming(false); }}>
              <Input aria-label="Pet name" className="h-8" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <Button size="sm" type="submit">Save</Button>
            </form>
          ) : (
            <p className="flex items-center gap-1 text-[12px] font-medium text-muted">{x.petName}<button type="button" aria-label="Rename pet" onClick={() => setNaming(true)} className="grid size-5 place-items-center rounded text-muted hover:bg-surface-3 hover:text-ink"><Icon name="pen" className="size-3" /></button></p>
          )}
          <p className="mt-0.5 text-[17px] font-semibold">{STAGE_NAME[g.stage]}</p>
          <p className="text-[12px] text-muted">{NEXT_STAGE[g.stage] === null ? 'All grown up. Still loves snacks.' : `${NEXT_STAGE[g.stage]! - g.p.sessions.length} more session${NEXT_STAGE[g.stage]! - g.p.sessions.length === 1 ? '' : 's'} to grow`}</p>
        </section>
        <Stat title="Today" value={fmtMinutes(g.today)} hint={`Goal ${fmtMinutes(g.p.dailyGoal)}`} frac={Math.min(1, g.today / Math.max(1, g.p.dailyGoal))} />
      </div>
      {designing && <PetDesigner stage={g.stage === 'egg' ? 'kid' : g.stage} onClose={() => setDesigning(false)} />}
    </div>
  );
}

function Stat({ title, value, hint, frac }: { title: string; value: string; hint: string; frac: number }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-[12px] font-medium text-muted">{title}</p>
      <p className="tnum mt-0.5 text-[17px] font-semibold">{value}</p>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-ok" style={{ width: `${Math.round(frac * 100)}%` }} /></span>
      <p className="tnum mt-1.5 text-[12px] text-muted">{hint}</p>
    </section>
  );
}

/** Open mystery packs. One for every hour of focus. */
export function PacksPanel() {
  const g = useGarden();
  const { x } = g;
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState<{ item: Item; dup: boolean } | null>(null);
  const open = () => {
    if (!g.packs || opening) return;
    setRevealed(null);
    setOpening(true);
    setTimeout(() => {
      const [r1, r2] = random();
      const item = rollItem(r1, r2);
      const st = useExtras.getState();
      const dup = st.inventory.includes(item.id);
      st.update({ packsOpened: st.packsOpened + 1, inventory: dup ? st.inventory : [...st.inventory, item.id], petWear: !dup && item.kind === 'pet' && !st.petWear ? item.id : st.petWear });
      if (dup) useProfile.getState().update({ points: useProfile.getState().points + DUPLICATE_POINTS });
      setRevealed({ item, dup });
      setOpening(false);
    }, 650);
  };
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-[15px] leading-6 font-semibold">Mystery packs</h2>
          <p className="text-[13px] text-muted">One for every hour of focus, plus one for every friend who joins from your invite link. Duplicates turn into +{DUPLICATE_POINTS} points.</p>
        </div>
        <Button onClick={open} disabled={!g.packs || opening}><Icon name="sparkle" className="size-4" /> {g.packs ? `Open a pack (${g.packs})` : 'No packs yet'}</Button>
      </div>
      <div className="mt-4 grid h-[150px] place-items-center rounded-xl border border-dashed border-line bg-surface-2" style={{ perspective: 600 }}>
        {opening ? (
          <div className="pack-shake grid h-[110px] w-[80px] place-items-center rounded-lg bg-accent-fill text-white"><Icon name="sparkle" className="size-6" /></div>
        ) : revealed ? (
          <div className="pack-reveal text-center">
            <span className={cn('inline-block rounded-md px-1.5 text-[11px] font-semibold uppercase', RARITY_STYLE[revealed.item.rarity])}>{revealed.item.rarity}</span>
            <p className="mt-1.5 text-[15px] font-semibold">{revealed.item.name}</p>
            <p className="text-[12px] text-muted">{revealed.dup ? `Already had it. +${DUPLICATE_POINTS} points.` : revealed.item.kind === 'tree' ? 'Added to your tree.' : `New outfit for ${x.petName}.`}</p>
          </div>
        ) : (
          <p className="px-4 text-center text-[13px] text-muted">{g.packs ? 'Ready when you are.' : `Next pack in ${fmtMinutes(60 - (g.total % 60))} of focus.`}</p>
        )}
      </div>
    </section>
  );
}

/** Every item, owned or still a mystery. */
export function Collection() {
  const inventory = useExtras((s) => s.inventory);
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-[15px] leading-6 font-semibold">Collection</h2>
        <span className="tnum text-[13px] text-muted">{ITEMS.filter((i) => inventory.includes(i.id)).length} of {ITEMS.length}</span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {ITEMS.map((i) => {
          const have = inventory.includes(i.id);
          return (
            <li key={i.id} className={cn('rounded-lg border px-2.5 py-2', have ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-2')}>
              <span className={cn('inline-block rounded px-1 text-[10px] font-semibold uppercase', have ? RARITY_STYLE[i.rarity] : 'text-muted')}>{i.rarity}</span>
              <p className={cn('mt-1 truncate text-[13px] font-medium', !have && 'text-muted')}>{have ? i.name : 'Not found yet'}</p>
              <p className="text-[11px] text-muted">{i.kind === 'tree' ? 'Tree' : 'Outfit'}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const SPECIES: { value: PetBody['species']; label: string }[] = [
  { value: 'cat', label: 'Cat' }, { value: 'bunny', label: 'Bunny' }, { value: 'bear', label: 'Bear' }, { value: 'pup', label: 'Pup' }, { value: 'blob', label: 'Sprout' },
];
const FURS = ['#f2c7a3', '#e8a87c', '#c98b5e', '#8a6248', '#f5efe6', '#b9b9c2', '#4a4a52', '#f3d36b', '#9fd3a6', '#9cc4ef', '#c7a8e8', '#f4a7b9'];
const EYES: { value: PetBody['eyes']; label: string }[] = [{ value: 'round', label: 'Round' }, { value: 'sparkle', label: 'Sparkly' }, { value: 'dot', label: 'Dots' }];
const MARKS: { value: PetBody['marking']; label: string }[] = [{ value: 'none', label: 'None' }, { value: 'spots', label: 'Spots' }, { value: 'stripe', label: 'Stripe' }, { value: 'patch', label: 'Eye patch' }];

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12px] font-semibold text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={cn('rounded-lg border px-2.5 py-1 text-[13px] font-medium', value === o.value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-2 hover:border-line-strong')}>{o.label}</button>)}
      </div>
    </fieldset>
  );
}

/** Make the pet your own: kind, color, eyes and markings, with a live preview. */
function PetDesigner({ stage, onClose }: { stage: ReturnType<typeof petStage>; onClose: () => void }) {
  const x = useExtras();
  const [body, setBody] = useState<PetBody>(x.petBody ?? DEFAULT_PET);
  const [name, setName] = useState(x.petName);
  const set = (patch: Partial<PetBody>) => setBody((b) => ({ ...b, ...patch }));
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  const surprise = () => setBody({ species: pick(SPECIES).value, fur: pick(FURS), eyes: pick(EYES).value, marking: pick(MARKS).value, blush: Math.random() > 0.3 });
  return (
    <Dialog open onClose={onClose} title="Customize your pet">
      <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <div className="aspect-square rounded-xl bg-surface-2 p-2"><PetArt mood="happy" wear={x.petWear} stage={stage} body={body} /></div>
          <Button size="sm" variant="secondary" onClick={surprise}><Icon name="sparkle" className="size-4" /> Surprise me</Button>
        </div>
        <div className="grid content-start gap-4">
          <div>
            <label htmlFor="petNameInput" className="mb-1.5 block text-[12px] font-semibold text-muted">Name</label>
            <Input id="petNameInput" className="h-9" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Chips label="Kind" value={body.species} options={SPECIES} onChange={(v) => set({ species: v })} />
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-semibold text-muted">Color</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {FURS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={body.fur === c} onClick={() => set({ fur: c })} className={cn('size-7 rounded-full border border-black/10', body.fur === c && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')} style={{ background: c }} />)}
              <label className="relative grid size-7 cursor-pointer place-items-center rounded-full border border-dashed border-line-strong text-muted" title="Pick any color">
                <Icon name="plus" className="size-3.5" />
                <input type="color" value={body.fur} onChange={(e) => set({ fur: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick any color" />
              </label>
            </div>
          </fieldset>
          <Chips label="Eyes" value={body.eyes} options={EYES} onChange={(v) => set({ eyes: v })} />
          <Chips label="Markings" value={body.marking} options={MARKS} onChange={(v) => set({ marking: v })} />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={body.blush} onChange={(e) => set({ blush: e.target.checked })} /> Rosy cheeks</label>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { x.update({ petBody: body, petName: name.trim().slice(0, 20) || 'Pip' }); onClose(); }}>Save</Button>
      </div>
    </Dialog>
  );
}
