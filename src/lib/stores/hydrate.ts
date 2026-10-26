'use client';
import { AI_KEY, useAi } from './ai';
import { LEARNING_KEY, useLearning } from './learning';
import { PROFILE_KEY, useProfile } from './profile';

const LEGACY = { profile: 'studytime-v1', learning: 'studytime-learning-v1', ai: 'studytime-ai-v1' };

function read(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
function write(key: string, state: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ state, version: 1 }));
  } catch {
    /* storage unavailable */
  }
}

/** Import data saved by the original single-file Studytime app (one time). */
export function migrateLegacy() {
  try {
    if (!localStorage.getItem(PROFILE_KEY)) {
      const old = read(LEGACY.profile);
      if (old && typeof old === 'object') {
        const { circleCode, memberId, memberPublicId, leaderboardToken, leaderboardId, ...rest } = old;
        write(PROFILE_KEY, {
          ...rest,
          circle: circleCode && memberId ? { code: circleCode, memberId, publicId: memberPublicId || '' } : null,
          leaderboard: leaderboardToken ? { token: leaderboardToken, id: leaderboardId || '' } : null,
        });
      }
    }
    if (!localStorage.getItem(LEARNING_KEY)) {
      const old = read(LEGACY.learning);
      if (old?.sets) write(LEARNING_KEY, old);
    }
    if (!localStorage.getItem(AI_KEY)) {
      const old = read(LEGACY.ai);
      if (old && typeof old === 'object') {
        const { apiKey, model, verifyModel, folders, ...rest } = old;
        void verifyModel;
        write(AI_KEY, {
          ...rest,
          noteFolders: Array.isArray(folders) ? folders : undefined,
          provider: apiKey ? 'anthropic' : 'gemini',
          keys: apiKey ? { anthropic: apiKey } : {},
          models: apiKey && model ? { anthropic: model } : {},
        });
      }
    }
  } catch {
    /* localStorage blocked */
  }
}

let hydrating: Promise<void> | null = null;
export function hydrateStores() {
  if (!hydrating) {
    migrateLegacy();
    hydrating = Promise.all([useProfile.persist.rehydrate(), useLearning.persist.rehydrate(), useAi.persist.rehydrate()]).then(() => undefined);
  }
  return hydrating;
}

// ---------- Backup ----------
export function exportBackup() {
  const strip = <T extends object>(s: T) => JSON.parse(JSON.stringify(s, (_k, v) => (typeof v === 'function' ? undefined : v)));
  const ai = strip(useAi.getState());
  ai.keys = {}; // never export API keys
  return JSON.stringify({ app: 'studytime', version: 1, exportedAt: new Date().toISOString(), profile: strip(useProfile.getState()), learning: strip(useLearning.getState()), ai }, null, 2);
}

export async function importBackup(text: string) {
  const data = JSON.parse(text);
  if (data?.app !== 'studytime' || !data.profile) throw new Error('This file is not a Studytime backup.');
  const keys = useAi.getState().keys;
  write(PROFILE_KEY, data.profile);
  if (data.learning) write(LEARNING_KEY, data.learning);
  if (data.ai) write(AI_KEY, { ...data.ai, keys });
  await Promise.all([useProfile.persist.rehydrate(), useLearning.persist.rehydrate(), useAi.persist.rehydrate()]);
}
