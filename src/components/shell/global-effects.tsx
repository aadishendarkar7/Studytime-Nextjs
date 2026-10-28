'use client';
import { useEffect } from 'react';
import { syncAfterSession } from '@/features/social/sync';
import { refreshStale, syncOutgoing } from '@/features/calendar/sync';
import { pulse } from '@/features/chat/live';
import { useBuddyEffects } from '@/features/focus/buddy';
import { usePactSync } from '@/features/pact/pact-card';
import { refreshDrops } from '@/features/drop/live';
import { beat } from '@/features/rooms/presence';
import { pauseSound, startSound, useSoundPlaying } from '@/features/sounds/controller';
import { applyAppearance } from '@/lib/appearance';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast, useUi } from '@/lib/stores/ui';

const REMINDER_LABEL = { homework: 'Homework', exam: 'Exam', assignment: 'Assignment' } as const;

export function sendBrowserAlert(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: 'studytime' });
  } catch {
    /* some browsers only allow service-worker notifications */
  }
}

const announced = new Set<string>();

/** App-wide background work: focus timer, reminders, planned sessions. */
export function GlobalEffects() {
  useBuddyEffects();
  usePactSync();
  // Colors and backdrop follow the profile.
  const accent = useProfile((s) => s.accent);
  const glow = useProfile((s) => s.glow);
  const backdrop = useProfile((s) => s.backdrop);
  const wash = useProfile((s) => s.wash);
  const theme = useProfile((s) => s.theme);
  const font = useProfile((s) => s.font);
  const corners = useProfile((s) => s.corners);
  useEffect(() => {
    const apply = () => applyAppearance({ accent, glow, backdrop, wash, theme, font, corners });
    apply();
    // "System" follows the device when it switches between light and dark.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [accent, glow, backdrop, wash, theme, font, corners]);

  // Focus sounds can follow the timer: start with a session, stop when it pauses or ends.
  useEffect(
    () =>
      useProfile.subscribe((state, prev) => {
        if (state.timer.mode === prev.timer.mode || !useExtras.getState().soundWithTimer) return;
        if (state.timer.mode === 'running') void startSound();
        else if (useSoundPlaying.getState().playing) pauseSound();
      }),
    [],
  );

  // Focus timer: tick every second; pause when the tab is hidden.
  useEffect(() => {
    const tick = () => {
      const result = useProfile.getState().tick();
      if (!result) return;
      toast(`Session complete. +${result.base + result.bonus} points${result.bonus ? ' including a bonus' : ''}.`);
      sendBrowserAlert('Focus session complete', `${result.session.minutes} minutes of ${result.session.subject} logged.`);
      useUi.getState().setReflectionOpen(true);
      syncAfterSession();
    };
    const onVisibility = () => {
      if (document.hidden) useProfile.getState().pauseTimer();
    };
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Connected calendars refresh every 15 minutes while the app is open.
  useEffect(() => {
    void refreshStale();
    const id = setInterval(() => void refreshStale(), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // Keep the Studytime subscribe link up to date when the plan changes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncOutgoing().catch(() => undefined), 3000);
    };
    const offExtras = useExtras.subscribe((s, prev) => {
      if (s.studyBlocks !== prev.studyBlocks || (s.outgoingFeed && !prev.outgoingFeed)) schedule();
    });
    const offProfile = useProfile.subscribe((s, prev) => {
      if (s.reminders !== prev.reminders) schedule();
    });
    return () => (clearTimeout(timer), offExtras(), offProfile());
  }, []);

  // Drop a Spot: check for new drops from friends and school every minute.
  useEffect(() => {
    void refreshDrops(false);
    const id = setInterval(() => void refreshDrops(), 60_000);
    return () => clearInterval(id);
  }, []);

  // Chat: show as online, pull who else is, and notify about new direct messages.
  useEffect(() => {
    const t = setTimeout(() => void pulse(false), 1500);
    const id = setInterval(() => void pulse(), 30_000);
    const onTimer = useProfile.subscribe((s, prev) => s.timer.mode !== prev.timer.mode && void pulse(false));
    return () => (clearTimeout(t), clearInterval(id), onTimer());
  }, []);

  // Study room presence: tell the room what you are doing, and receive kudos, anywhere in the app.
  const inRoom = useExtras((s) => Boolean(s.room));
  useEffect(() => {
    if (!inRoom) return;
    void beat();
    const id = setInterval(() => void beat(), 20_000);
    const onTimer = useProfile.subscribe((s, prev) => s.timer.mode !== prev.timer.mode && void beat());
    return () => (clearInterval(id), onTimer());
  }, [inRoom]);

  // Deadline reminders and planned study sessions.
  useEffect(() => {
    const check = () => {
      const p = useProfile.getState();
      const now = Date.now();
      const due = p.reminders.filter((r) => !r.done && !r.notifiedAt && now >= r.dueAt - r.lead * 60_000);
      if (due.length) {
        p.markNotified(due.map((r) => r.id));
        for (const r of due) {
          toast(`${REMINDER_LABEL[r.type]} reminder: ${r.title}`);
          sendBrowserAlert('Studytime reminder', `${REMINDER_LABEL[r.type]}: ${r.title} is due ${new Date(r.dueAt).toLocaleString()}.`);
        }
      }
      // Planned study blocks: one alert as each starts.
      for (const b of useExtras.getState().studyBlocks) {
        if (b.done || announced.has(b.id) || now < b.start || now > b.start + 10 * 60_000) continue;
        announced.add(b.id);
        toast(`Study block now: ${b.title}`);
        sendBrowserAlert('Study block starting', b.title);
      }
      if (p.nextPlanAt && !p.nextPlanNotified && now >= p.nextPlanAt) {
        p.update({ nextPlanNotified: true });
        toast('Your planned study time is now.');
        sendBrowserAlert('Time to study', 'Open Studytime to start your planned focus session.');
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
