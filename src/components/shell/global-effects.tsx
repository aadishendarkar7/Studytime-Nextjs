'use client';
import { useEffect } from 'react';
import { syncAfterSession } from '@/features/social/sync';
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

/** App-wide background work: focus timer, reminders, planned sessions, theme. */
export function GlobalEffects() {
  const theme = useProfile((s) => s.theme);
  const accent = useProfile((s) => s.accent);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--accent', accent);
  }, [theme, accent]);

  // Focus timer: tick every second; pause when the tab is hidden.
  useEffect(() => {
    const tick = () => {
      const result = useProfile.getState().tick();
      if (!result) return;
      toast(`Session complete! +${result.base + result.bonus} points${result.bonus ? ' including a bonus' : ''}.`);
      sendBrowserAlert('Focus session complete', `Nice work: ${result.session.minutes} minutes of ${result.session.subject}.`);
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
        toast('Your planned study time is here. Ready for one small step?');
        sendBrowserAlert('Time to study', 'Open Studytime and begin your planned focus session.');
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
