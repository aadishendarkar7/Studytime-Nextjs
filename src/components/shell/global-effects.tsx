'use client';
import { useEffect } from 'react';
import { syncAfterSession } from '@/features/social/sync';
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

/** App-wide background work: focus timer, reminders, planned sessions. */
export function GlobalEffects() {
  // Colors and backdrop follow the profile.
  const accent = useProfile((s) => s.accent);
  const glow = useProfile((s) => s.glow);
  const backdrop = useProfile((s) => s.backdrop);
  const wash = useProfile((s) => s.wash);
  useEffect(() => applyAppearance(accent, glow, backdrop, wash), [accent, glow, backdrop, wash]);

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
