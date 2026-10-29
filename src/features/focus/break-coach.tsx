'use client';
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { WaterTracker } from '@/features/wellbeing/water';
import { useProfile } from '@/lib/stores/profile';
import { fmtClock } from '@/lib/utils';

type Kind = 'breathe' | 'stretch' | 'water' | 'eyes';

const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'] as const;
const STRETCHES = [
  { name: 'Neck rolls', how: 'Drop your chin, then roll your head slowly from shoulder to shoulder. Five times each way.' },
  { name: 'Shoulder shrugs', how: 'Lift both shoulders to your ears, hold for two seconds, drop them. Ten times.' },
  { name: 'Seated twist', how: 'Sit tall, hold the back of your chair and turn your upper body. Hold 15 seconds each side.' },
  { name: 'Wrist and finger stretch', how: 'Arm out, palm up, gently pull your fingers back with the other hand. 15 seconds each hand.' },
  { name: 'Stand and reach', how: 'Stand up, reach both arms over your head, then fold forward toward your toes. Breathe slowly.' },
];

/** Box breathing: four counts in, hold, out, hold. The square grows and shrinks with the breath. */
function Breathe() {
  const [on, setOn] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
  const phase = Math.floor(tick / 4) % 4;
  const count = 4 - (tick % 4);
  const big = on && (phase === 0 || phase === 1);
  return (
    <div className="flex items-center gap-4">
      <div className="grid size-24 shrink-0 place-items-center">
        <div className="grid place-items-center rounded-xl bg-accent-soft text-accent-ink transition-all duration-[4000ms] ease-in-out" style={{ width: big ? 96 : 52, height: big ? 96 : 52 }}>
          <span className="tnum font-display text-[20px]">{on ? count : ''}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[18px]" aria-live="polite">{on ? PHASES[phase] : 'Box breathing'}</p>
        <p className="text-[13px] text-muted">{on ? `Round ${Math.floor(tick / 16) + 1} of 4` : '4 in, 4 hold, 4 out, 4 hold'}</p>
        <Button size="sm" className="mt-2" variant={on ? 'secondary' : 'primary'} onClick={() => (setOn(!on), setTick(0))}>{on ? 'Stop' : 'Start'}</Button>
      </div>
    </div>
  );
}

function Stretch() {
  const [i, setI] = useState(0);
  const s = STRETCHES[i];
  return (
    <div>
      <p className="text-[15px] font-semibold">{s.name} <span className="font-normal text-muted">· {i + 1}/{STRETCHES.length}</span></p>
      <p className="mt-1 text-[14px] leading-6 text-ink-2">{s.how}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        <Button size="sm" onClick={() => setI((i + 1) % STRETCHES.length)}>{i === STRETCHES.length - 1 ? 'Start over' : 'Next'}</Button>
      </div>
    </div>
  );
}

/** The 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds. */
function Eyes() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <div className="flex items-center gap-4">
      <p className="tnum w-24 shrink-0 text-center font-display text-[32px]" aria-live="polite">{left === null ? '0:20' : left > 0 ? `0:${String(left).padStart(2, '0')}` : 'Done'}</p>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-ink-2">Look at something far away and blink.</p>
        <Button size="sm" className="mt-2" onClick={() => setLeft(20)}>{left === null ? 'Start' : 'Again'}</Button>
      </div>
    </div>
  );
}

export function BreakCoach({ className }: { className?: string }) {
  const [kind, setKind] = useState<Kind>('breathe');
  const [breakEnds, setBreakEnds] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const lastSession = useProfile((s) => s.sessions[0]);
  useEffect(() => {
    if (!breakEnds) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [breakEnds]);
  const left = breakEnds ? Math.max(0, Math.ceil((breakEnds - now) / 1000)) : 0;
  const [justDone] = useState(() => Boolean(lastSession && Date.now() - new Date(lastSession.at).getTime() < 15 * 60_000));
  return (
    <Card className={className}>
      <CardHeader
        title={justDone ? 'Session done. Take a break.' : 'Take a break'}
        action={breakEnds && left > 0 ? <span className="tnum rounded-lg bg-accent-soft px-3 py-1.5 font-semibold text-accent-ink">{fmtClock(left)}</span> : <Button size="sm" variant="secondary" onClick={() => (setBreakEnds(Date.now() + 5 * 60_000), setNow(Date.now()))}>{breakEnds ? 'Another 5 min' : '5 min break'}</Button>}
      />
      <Segmented label="Break activity" value={kind} onChange={setKind} options={[{ value: 'breathe', label: 'Breathe' }, { value: 'stretch', label: 'Stretch' }, { value: 'water', label: 'Water' }, { value: 'eyes', label: 'Rest eyes' }]} />
      <div className="mt-3 min-h-24">
        {kind === 'breathe' && <Breathe />}
        {kind === 'stretch' && <Stretch />}
        {kind === 'water' && <WaterTracker />}
        {kind === 'eyes' && <Eyes />}
      </div>
    </Card>
  );
}
