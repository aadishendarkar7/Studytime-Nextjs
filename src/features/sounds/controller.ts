'use client';
import { create } from 'zustand';
import { useExtras } from '@/lib/stores/extras';
import { toast } from '@/lib/stores/ui';
import { playSound, setSoundVolume, SOUNDS, stopSound, type SoundId } from './engine';

/** Whether a sound is playing right now. Not saved: browsers only allow audio after a click. */
export const useSoundPlaying = create<{ playing: boolean }>()(() => ({ playing: false }));

export const soundLabel = (id: SoundId) => SOUNDS.find((s) => s.id === id)?.label ?? 'Sound';

export async function startSound(id?: SoundId) {
  const extras = useExtras.getState();
  const sound = id ?? extras.sound;
  if (id && id !== extras.sound) extras.update({ sound: id });
  try {
    await playSound(sound, extras.volume);
    useSoundPlaying.setState({ playing: true });
  } catch {
    toast('This browser could not start audio.', 'error');
  }
}

export function pauseSound() {
  stopSound();
  useSoundPlaying.setState({ playing: false });
}

export function toggleSound() {
  if (useSoundPlaying.getState().playing) pauseSound();
  else void startSound();
}

export function changeVolume(v: number) {
  useExtras.getState().update({ volume: v });
  setSoundVolume(v);
}
