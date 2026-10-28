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
    <div className="flex flex-col items-center py-2 text-center">
      <div className="grid size-44 place-items-center">
        <div className="grid place-items-center rounded-xl bg-accent-soft text-accent-ink transition-all duration-[4000ms] ease-in-out" style={{ width: big ? 176 : 96, height: big ? 176 : 96 }}>
          <span className="tnum font-display text-[28px]">{on ? count : ''}</span>
        </div>
      </div>
      <p className="mt-3 font-display text-[22px]" aria-live="polite">{on ? PHASES[phase] : 'Box breathing'}</p>
      <p className="mt-1 max-w-[40ch] text-[14px] text-muted">{on ? `Round ${Math.floor(tick / 16) + 1}. Four or five rounds is enough.` : 'Four counts in, hold for four, four counts out, hold for four. It slows your heart rate and settles your attention.'}</p>
      <Button className="mt-4" variant={on ? 'secondary' : 'primary'} onClick={() => (setOn(!on), setTick(0))}>{on ? 'Stop' : 'Start breathing'}</Button>
    </div>
  );
}

function Stretch() {
  const [i, setI] = useState(0);
  const s = STRETCHES[i];
  return (
    <div className="py-2">
      <p className="text-[13px] text-muted">{i + 1} of {STRETCHES.length}</p>
      <h3 className="mt-1 text-[22px]">{s.name}</h3>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-6 text-ink-2">{s.how}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        <Button onClick={() => setI((i + 1) % STRETCHES.length)}>{i === STRETCHES.length - 1 ? 'Start over' : 'Next stretch'}</Button>
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
    <div className="py-2">
      <h3 className="text-[22px]">Rest your eyes</h3>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-6 text-ink-2">Look at something at least 20 feet away, like a window or the far wall, for 20 seconds. Blink a few times.</p>
      <p className="tnum mt-3 font-display text-[40px]" aria-live="polite">{left === null ? '0:20' : left > 0 ? `0:${String(left).padStart(2, '0')}` : 'Done'}</p>
      <Button className="mt-2" onClick={() => setLeft(20)}>{left === null ? 'Start 20 seconds' : 'Again'}</Button>
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
        title={justDone ? 'Session done. Take a real break.' : 'Take a real break'}
        description="Five minutes away from the screen helps you come back sharper than scrolling does."
        action={breakEnds && left > 0 ? <span className="tnum rounded-lg bg-accent-soft px-3 py-1.5 font-semibold text-accent-ink">{fmtClock(left)}</span> : <Button size="sm" variant="secondary" onClick={() => (setBreakEnds(Date.now() + 5 * 60_000), setNow(Date.now()))}>{breakEnds ? 'Break over. Another 5 min?' : 'Start a 5 min break'}</Button>}
      />
      <Segmented label="Break activity" value={kind} onChange={setKind} options={[{ value: 'breathe', label: 'Breathe' }, { value: 'stretch', label: 'Stretch' }, { value: 'water', label: 'Water' }, { value: 'eyes', label: 'Rest eyes' }]} />
      <div className="mt-4">
        {kind === 'breathe' && <Breathe />}
        {kind === 'stretch' && <Stretch />}
        {kind === 'water' && <div className="py-2"><p className="mb-3 max-w-[52ch] text-[15px] leading-6 text-ink-2">Even mild dehydration makes it harder to concentrate. Have a glass and log it.</p><WaterTracker /></div>}
        {kind === 'eyes' && <Eyes />}
      </div>
    </Card>
  );
}
