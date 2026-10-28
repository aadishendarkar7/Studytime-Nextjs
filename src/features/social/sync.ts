'use client';
import { api, ApiError } from '@/lib/api';
import { streaks, weekMinutes } from '@/features/focus/logic';
import { useExtras } from '@/lib/stores/extras';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import type { CircleMemberView } from '@/lib/types';

/** Push this week's minutes to the study circle. Returns the circle's members. */
export async function syncCircle(): Promise<CircleMemberView[] | null> {
  const p = useProfile.getState();
  if (!p.circle) return null;
  try {
    const { members } = await api.circles.update(p.circle.code, p.circle.memberId, { name: p.name, minutes: weekMinutes(p.sessions), streak: streaks(p.sessions).current });
    return members;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) useProfile.getState().update({ circle: null });
    throw error;
  }
}

/** Drops you hosted or joined since Monday. */
export function weekDrops(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return useExtras.getState().dropLog.filter((e) => e.role !== 'solo' && e.at >= d.getTime() && e.at <= now).length;
}

/** Make sure this browser has a leaderboard profile, then push the latest stats. */
export async function syncLeaderboardProfile() {
  let p = useProfile.getState();
  if (!p.leaderboard) {
    const reg = await api.leaderboard.register();
    p.update({ leaderboard: { token: reg.token, id: reg.id } });
    p = useProfile.getState();
  }
  const minutes = weekMinutes(p.sessions);
  try {
    await api.leaderboard.profile(p.leaderboard!.token, { name: p.name, school: p.school, major: p.major, year: p.year, minutes, drops: weekDrops() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      p.update({ leaderboard: null });
      return syncLeaderboardProfile();
    }
    throw error;
  }
  const cls = useLearning.getState().classSession;
  if (cls) await api.classes.progress(cls.code, cls.token, minutes).catch(() => {});
  return useProfile.getState().leaderboard!;
}

/** Fire-and-forget sync after a session completes. */
export function syncAfterSession() {
  syncCircle().catch(() => {});
  if (useProfile.getState().leaderboard) syncLeaderboardProfile().catch(() => {});
}
