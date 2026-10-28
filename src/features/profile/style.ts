/** The study style quiz: six questions on three axes. */
export type Axis = 'time' | 'social' | 'rhythm';
export interface Question { q: string; options: { label: string; axis: Axis; score: number }[] }

export const QUESTIONS: Question[] = [
  { q: 'When do you get your best work done?', options: [{ label: 'Morning, before the day gets busy', axis: 'time', score: -1 }, { label: 'Afternoon', axis: 'time', score: 0 }, { label: 'Late at night when it is quiet', axis: 'time', score: 1 }] },
  { q: 'A big exam is a week away. You…', options: [{ label: 'Get a group together', axis: 'social', score: 1 }, { label: 'Lock in alone', axis: 'social', score: -1 }, { label: 'Study alone, then check answers with a friend', axis: 'social', score: 0 }] },
  { q: 'Your ideal study session looks like…', options: [{ label: 'Short bursts with breaks', axis: 'rhythm', score: -1 }, { label: 'One long deep dive', axis: 'rhythm', score: 1 }] },
  { q: 'Where is your phone while you study?', options: [{ label: 'Another room, out of sight', axis: 'rhythm', score: 1 }, { label: 'Nearby, for quick checks between bursts', axis: 'rhythm', score: -1 }] },
  { q: 'You remember things best by…', options: [{ label: 'Explaining them to someone', axis: 'social', score: 1 }, { label: 'Writing my own notes', axis: 'social', score: -1 }] },
  { q: 'Your study drink is…', options: [{ label: 'An 8 AM coffee', axis: 'time', score: -1 }, { label: 'Whatever is in the vending machine at 10 PM', axis: 'time', score: 1 }] },
];

export interface Style { id: string; name: string; blurb: string; tips: string[]; length: number; vibe: 'silent' | 'quiet' | 'group' }

export const STYLES: Record<string, Style> = {
  'morning-solo-deep': { id: 'morning-solo-deep', name: 'Early Monk', blurb: 'You do your best thinking early, alone, and for a long stretch.', tips: ['Block your first two hours for the hardest course.', 'Set a wind-down time so mornings stay sharp.', 'Use 60 to 90 minute sessions.'], length: 90, vibe: 'silent' },
  'morning-solo-sprint': { id: 'morning-solo-sprint', name: 'Sunrise Sprinter', blurb: 'Early starts and quick, focused bursts keep you moving.', tips: ['Stack three 25 minute sessions before lunch.', 'Take real breaks away from the screen.', 'Plan tomorrow the night before.'], length: 25, vibe: 'silent' },
  'morning-group-deep': { id: 'morning-group-deep', name: 'Study Hall Captain', blurb: 'You like company, a plan, and a long session to work through it.', tips: ['Host a morning study event for your course.', 'Split problem sets and teach each other.', 'Keep a shared agenda so the group stays on track.'], length: 90, vibe: 'group' },
  'morning-group-sprint': { id: 'morning-group-sprint', name: 'Coffee Crew', blurb: 'Morning energy, friends nearby, and quick rounds of work.', tips: ['Drop a spot with a quiet chat vibe.', 'Do a speed round of flashcards together.', 'Agree on break times before you start.'], length: 30, vibe: 'quiet' },
  'night-solo-deep': { id: 'night-solo-deep', name: 'Midnight Scholar', blurb: 'Quiet nights and long, uninterrupted focus are your thing.', tips: ['Protect sleep: set a wind-down time anyway.', 'Use a steady focus sound to block noise.', 'Put the hardest task first, not last.'], length: 60, vibe: 'silent' },
  'night-solo-sprint': { id: 'night-solo-sprint', name: 'Night Sprinter', blurb: 'You get going later and work best in short bursts.', tips: ['Use 25 to 30 minute sessions with water breaks.', 'Turn on a Focus Buddy for late-night company.', 'Stop by your wind-down time to keep tomorrow good.'], length: 30, vibe: 'silent' },
  'night-group-deep': { id: 'night-group-deep', name: 'Late Library Crew', blurb: 'Evenings with friends and one long push through the material.', tips: ['Drop a spot at the library after dinner.', 'Pick one goal for the night before you sit down.', 'Walk back together and call it a night.'], length: 60, vibe: 'group' },
  'night-group-sprint': { id: 'night-group-sprint', name: 'After-Hours Squad', blurb: 'Late, social and fast: you study best with people around.', tips: ['Keep sessions short so chat does not take over.', 'Use matching games to quiz each other.', 'Agree on a stop time before you start.'], length: 25, vibe: 'quiet' },
};

/** answers[i] is the chosen option index for QUESTIONS[i]. */
export function styleFor(answers: number[]): Style {
  const t = { time: 0, social: 0, rhythm: 0 };
  answers.forEach((a, i) => {
    const o = QUESTIONS[i]?.options[a];
    if (o) t[o.axis] += o.score;
  });
  const key = `${t.time > 0 ? 'night' : 'morning'}-${t.social > 0 ? 'group' : 'solo'}-${t.rhythm > 0 ? 'deep' : 'sprint'}`;
  return STYLES[key];
}

export const PROMPTS = [
  'My go-to study snack is',
  'The class I could teach is',
  'I study best when',
  'Ask me for help with',
  'My study playlist is',
  'After finals I am',
  'Do not talk to me before',
  'My unpopular study opinion',
  'The spot on campus I swear by',
  'I will never understand',
] as const;
