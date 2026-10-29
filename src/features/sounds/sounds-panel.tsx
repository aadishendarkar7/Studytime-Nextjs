import type { SoundId } from './engine';

/** How the focus sounds are grouped in the sound picker. */
export const GROUPS: { label: string; ids: SoundId[] }[] = [
  { label: 'Noise', ids: ['bright', 'balanced', 'dark'] },
  { label: 'Nature', ids: ['rain', 'roof', 'ocean', 'stream', 'night', 'quietnight', 'fire'] },
  { label: 'Places', ids: ['babble', 'steam', 'airplane', 'boat', 'bus', 'train'] },
  { label: 'Study music', ids: ['lofi', 'ambient'] },
];
