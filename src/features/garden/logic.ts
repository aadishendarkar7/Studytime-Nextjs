/** Tree, pet and mystery packs. Everything is counted from focus minutes saved in this browser. */

export const STAGES = [
  { at: 0, name: 'Seed' },
  { at: 60, name: 'Sprout' },
  { at: 180, name: 'Seedling' },
  { at: 420, name: 'Sapling' },
  { at: 900, name: 'Young tree' },
  { at: 1800, name: 'Tree' },
  { at: 3600, name: 'Big tree' },
  { at: 6000, name: 'Old oak' },
  { at: 9000, name: 'Grand oak' },
];

/** Every minute of focus is one drop of water for the tree. */
export function treeStage(totalMinutes: number) {
  let i = 0;
  while (i + 1 < STAGES.length && totalMinutes >= STAGES[i + 1].at) i++;
  const next = STAGES[i + 1];
  return { stage: i, name: STAGES[i].name, next: next ? { name: next.name, need: next.at - totalMinutes, frac: (totalMinutes - STAGES[i].at) / (next.at - STAGES[i].at) } : null };
}

export type Mood = 'thriving' | 'happy' | 'sleepy' | 'missing';
export const MOOD_TEXT: Record<Mood, string> = {
  thriving: 'is thriving. You hit your goal today.',
  happy: 'is happy you studied today.',
  sleepy: 'is a little sleepy. One short session would wake it up.',
  missing: 'misses you. Even five minutes counts.',
};

export function petMood(input: { today: number; goal: number; lastSessionAt: number | null; now: number }): Mood {
  if (input.today >= input.goal) return 'thriving';
  if (input.today > 0) return 'happy';
  if (input.lastSessionAt && input.now - input.lastSessionAt < 3 * 86_400_000) return 'sleepy';
  return 'missing';
}

export type Rarity = 'common' | 'rare' | 'epic';
export interface Item { id: string; name: string; kind: 'tree' | 'pet'; rarity: Rarity }
export const ITEMS: Item[] = [
  { id: 'birds', name: 'Songbirds', kind: 'tree', rarity: 'common' },
  { id: 'blossoms', name: 'Blossoms', kind: 'tree', rarity: 'common' },
  { id: 'fruit', name: 'Fruit', kind: 'tree', rarity: 'common' },
  { id: 'swing', name: 'Rope swing', kind: 'tree', rarity: 'rare' },
  { id: 'lanterns', name: 'Paper lanterns', kind: 'tree', rarity: 'rare' },
  { id: 'birdhouse', name: 'Birdhouse', kind: 'tree', rarity: 'rare' },
  { id: 'fireflies', name: 'Fireflies', kind: 'tree', rarity: 'epic' },
  { id: 'moon', name: 'Crescent moon', kind: 'tree', rarity: 'epic' },
  { id: 'scarf', name: 'Scarf', kind: 'pet', rarity: 'common' },
  { id: 'beanie', name: 'Beanie', kind: 'pet', rarity: 'common' },
  { id: 'bow', name: 'Bow', kind: 'pet', rarity: 'common' },
  { id: 'glasses', name: 'Reading glasses', kind: 'pet', rarity: 'rare' },
  { id: 'headphones', name: 'Headphones', kind: 'pet', rarity: 'rare' },
  { id: 'gradcap', name: 'Graduation cap', kind: 'pet', rarity: 'epic' },
];
export const RARITY_ODDS: Record<Rarity, number> = { common: 0.65, rare: 0.28, epic: 0.07 };
export const DUPLICATE_POINTS = 15;

/** One pack for every hour of focus. */
export const packsEarned = (totalMinutes: number) => Math.floor(totalMinutes / 60);

/** Pick an item: first the rarity by its odds, then an item of that rarity. r1 and r2 are numbers in [0, 1). */
export function rollItem(r1: number, r2: number): Item {
  const rarity: Rarity = r1 < RARITY_ODDS.epic ? 'epic' : r1 < RARITY_ODDS.epic + RARITY_ODDS.rare ? 'rare' : 'common';
  const pool = ITEMS.filter((i) => i.rarity === rarity);
  return pool[Math.min(pool.length - 1, Math.floor(r2 * pool.length))];
}

export type Sky = 'dawn' | 'day' | 'dusk' | 'night';
export const skyAt = (hour: number): Sky => (hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'dusk' : 'night');
/** The pet sleeps late at night unless you are studying. */
export const isAsleep = (hour: number, focusing: boolean) => !focusing && (hour >= 23 || hour < 6);

export interface LineInput { name: string; mood: Mood; egg: boolean; asleep: boolean; focusing: boolean; sky: Sky; today: number; goal: number; glasses: number }

/** Things the pet can say right now. Tapping it cycles through them. */
export function petLines(i: LineInput): string[] {
  if (i.egg) return ['…', '(something is wiggling in there)', 'Finish one focus session and I hatch.', 'Tap tap. Is it time yet?'];
  if (i.asleep) return ['Zzz…', 'Zzz… five more minutes…', '(dreaming about flashcards)'];
  if (i.focusing) return ['Shh. We are focusing.', 'I am reading too. Page 4.', 'Rain is good for the tree. Keep going.', 'No phone. I am watching.'];
  const left = Math.max(0, i.goal - i.today);
  const base: Record<Mood, string[]> = {
    thriving: ['Goal done. We are so back.', `${i.today} minutes today. Showing off now?`, 'The tree says thank you.', 'Victory lap? Victory lap.'],
    happy: [`${left} more minutes and we hit the goal.`, 'Good start. One more round?', 'I saved you a seat.'],
    sleepy: ['*yawn* Is it study o’clock?', 'Wake me up with a short session.', 'The tree looks thirsty.'],
    missing: ['Oh! You came back.', 'I counted the leaves while you were gone. 212.', 'Five minutes? For me?'],
  };
  const extra = [
    i.sky === 'night' ? 'Late night, huh. Water first.' : i.sky === 'dawn' ? 'Early bird gets the library table.' : i.sky === 'dusk' ? 'Golden hour. Perfect for one more session.' : 'Nice day for a study spot outside.',
    i.glasses === 0 ? 'Have you had any water today?' : `${i.glasses} glass${i.glasses === 1 ? '' : 'es'} of water so far. Nice.`,
  ];
  return [...base[i.mood], ...extra];
}
