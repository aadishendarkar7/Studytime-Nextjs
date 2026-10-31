import type { Deck } from '@/lib/types';

/**
 * Special collections: themed flashcard packs that show up around the days
 * students care about (Halloween, midterms, finals, test season, back to school).
 * Each one has a window of dates (month 1–12, day) and can wrap the new year.
 */
export interface Collection {
  id: string;
  title: string;
  blurb: string;
  mark: string;
  from: [number, number];
  to: [number, number];
  decks: Deck[];
}

const deck = (collection: string, name: string, subject: string, pairs: [string, string][]): Deck => ({
  id: `collection-${collection}-${name.toLowerCase().replace(/\W+/g, '-')}`,
  name,
  subject,
  cards: pairs.map(([front, back]) => ({ front, back })),
});

export const COLLECTIONS: Collection[] = [
  {
    id: 'halloween',
    title: 'Spooky Science',
    blurb: 'Halloween week: the real science behind the creepy stuff.',
    mark: '🎃',
    from: [10, 20],
    to: [11, 2],
    decks: [
      deck('halloween', 'Spooky Biology', 'Biology', [
        ['Why do bats hunt at night with sound?', 'Echolocation: they read returning echoes to find prey in the dark'],
        ['What makes fireflies and some fungi glow?', 'Bioluminescence: luciferin reacts with oxygen, helped by the enzyme luciferase'],
        ['Rigor mortis', 'Muscles stiffen after death because ATP runs out and myosin stays bound to actin'],
        ['Why do pumpkins turn orange?', 'Carotenoids such as beta-carotene'],
        ['Zombie ant fungus', 'Ophiocordyceps takes over an ant’s behavior to spread its spores'],
        ['Why do spiders have 8 legs but insects 6?', 'Spiders are arachnids, a different arthropod class from insects'],
        ['Vampire bats feed on…', 'Blood; their saliva has an anticoagulant called draculin'],
        ['Goosebumps', 'Tiny muscles (arrector pili) pull hairs upright, a leftover fight-or-flight reflex'],
      ]),
      deck('halloween', 'Witch’s Chemistry', 'Chemistry', [
        ['Why does dry ice make spooky fog?', 'Solid CO₂ sublimates at −78.5 °C and chills water vapor into fog'],
        ['Glow sticks work by…', 'Chemiluminescence: a peroxide reaction excites a dye that releases light'],
        ['Why does a glow stick glow longer in the freezer?', 'Cold slows the reaction rate'],
        ['Phosphorescence', 'Light released slowly after absorbing energy (glow-in-the-dark paint)'],
        ['Elephant toothpaste', 'Hydrogen peroxide decomposes fast with a catalyst, releasing O₂ foam'],
        ['Why do candles go out under a jar?', 'Combustion uses up the oxygen'],
      ]),
    ],
  },
  {
    id: 'midterms-fall',
    title: 'Midterm Survival',
    blurb: 'Midterm season: how to study smarter, not longer.',
    mark: '📚',
    from: [10, 1],
    to: [11, 15],
    decks: [
      deck('midterms', 'Exam Strategy', 'Learning', [
        ['Best way to study for a test', 'Practice testing: answer questions from memory, then check'],
        ['Why space your studying?', 'Reviewing across several days beats one long cram (spacing effect)'],
        ['Interleaving', 'Mixing problem types in one session so you learn when to use each method'],
        ['First thing to do when you get the exam', 'Skim all of it, then start with questions you know'],
        ['Stuck on a question?', 'Mark it, move on, come back at the end'],
        ['The night before', 'Light review and real sleep; sleep locks in memory'],
        ['Feynman technique', 'Explain the idea simply as if teaching someone; gaps show what to review'],
        ['Brain dump', 'At the start, write the formulas you are afraid of forgetting'],
      ]),
    ],
  },
  {
    id: 'thanksgiving',
    title: 'Grateful & Grounded',
    blurb: 'Thanksgiving break: recharge and keep your streak alive with short reviews.',
    mark: '🍂',
    from: [11, 20],
    to: [11, 30],
    decks: [
      deck('thanksgiving', 'Rest & Focus Science', 'Wellbeing', [
        ['How long should a study break be?', 'About 5–10 minutes after 25–50 minutes of focus'],
        ['Why does sleep help memory?', 'During deep sleep the brain replays and stores what you learned'],
        ['Tryptophan myth', 'Turkey has about as much tryptophan as chicken; big meals cause the sleepiness'],
        ['Gratitude journaling', 'Writing 3 good things a day is linked to better mood and sleep'],
        ['Best way to restart after a break', 'A short review session to warm up before new material'],
      ]),
    ],
  },
  {
    id: 'finals-fall',
    title: 'Finals Week',
    blurb: 'Finals are here: formula packs and a game plan for every exam.',
    mark: '🎓',
    from: [12, 1],
    to: [12, 22],
    decks: [
      deck('finals', 'Finals Game Plan', 'Learning', [
        ['Two weeks out', 'List every exam, its date and topics, then plan study blocks backwards'],
        ['What to study first', 'Weakest topics that are worth the most points'],
        ['How to use old exams', 'Take them timed, then study only what you missed'],
        ['Cramming vs spacing', 'Spacing wins; if you must cram, test yourself instead of rereading'],
        ['Exam morning', 'Eat, hydrate, quick look at your brain dump sheet, no new material'],
        ['After each exam', 'Reset: short walk, then switch to the next subject'],
      ]),
      deck('finals', 'Math & Science Formula Sheet', 'Math', [
        ['Quadratic formula', 'x = (−b ± √(b² − 4ac)) / 2a'],
        ['Slope', 'm = (y₂ − y₁) / (x₂ − x₁)'],
        ['Area of a circle', 'πr²'],
        ['Fundamental theorem of calculus', '∫ₐᵇ f(x) dx = F(b) − F(a)'],
        ['Integration by parts', '∫u dv = uv − ∫v du'],
        ['Ideal gas law', 'PV = nRT'],
        ['Newton’s second law', 'F = ma'],
        ['z-score', 'z = (x − μ) / σ'],
      ]),
    ],
  },
  {
    id: 'new-year',
    title: 'Fresh Start',
    blurb: 'New semester: build habits that stick.',
    mark: '✨',
    from: [12, 28],
    to: [1, 31],
    decks: [
      deck('new-year', 'Habits That Stick', 'Learning', [
        ['Habit stacking', 'Attach a new habit to one you already do: “After coffee, 1 review session”'],
        ['Two-minute rule', 'Start any habit with a version that takes under 2 minutes'],
        ['Why track a streak?', 'Seeing progress is a reward that keeps you going'],
        ['Implementation intention', 'Plan “When X happens, I will do Y” to make starting automatic'],
        ['Best goal size', 'Small and specific: “25 minutes of bio daily” beats “study more”'],
      ]),
    ],
  },
  {
    id: 'test-season',
    title: 'AP & Finals Season',
    blurb: 'Spring exam season: high-yield review packs.',
    mark: '📝',
    from: [4, 20],
    to: [5, 20],
    decks: [
      deck('test-season', 'High-Yield Biology', 'Biology', [
        ['Central dogma', 'DNA → RNA → protein'],
        ['Mitosis vs meiosis', 'Mitosis: 2 identical cells; meiosis: 4 genetically different gametes'],
        ['Photosynthesis equation', '6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂'],
        ['Enzyme', 'Protein that speeds up a reaction by lowering activation energy'],
        ['Natural selection', 'Heritable traits that improve survival and reproduction become more common'],
        ['Homeostasis', 'Keeping internal conditions stable'],
      ]),
      deck('test-season', 'High-Yield History Terms', 'History', [
        ['Federalism', 'Power shared between national and state governments'],
        ['Checks and balances', 'Each branch of government can limit the others'],
        ['Industrial Revolution', 'Shift to machine and factory production, starting in 1700s Britain'],
        ['Cold War', 'US–Soviet rivalry, about 1947–1991, without direct full-scale war'],
        ['Primary source', 'A document or object made at the time being studied'],
      ]),
    ],
  },
  {
    id: 'back-to-school',
    title: 'Back to School',
    blurb: 'New classes: start strong in week one.',
    mark: '🎒',
    from: [8, 15],
    to: [9, 20],
    decks: [
      deck('back-to-school', 'Start Strong', 'Learning', [
        ['First thing to do with a syllabus', 'Put every exam and due date in your calendar'],
        ['Office hours', 'Free 1-on-1 help from the professor or TA; go early in the term'],
        ['Cornell notes', 'Notes on the right, cue questions on the left, summary at the bottom'],
        ['Preview before lecture', '10 minutes skimming the reading makes the lecture stick'],
        ['Study group size that works best', 'About 3–4 people with a clear goal for each session'],
      ]),
    ],
  },
];

const dayOfYear = (month: number, day: number) => month * 100 + day;

/** Whether a collection's window includes this date. Windows like Dec 28 to Jan 31 wrap the new year. */
export function isActive(c: Collection, now = new Date()) {
  const today = dayOfYear(now.getMonth() + 1, now.getDate());
  const from = dayOfYear(...c.from);
  const to = dayOfYear(...c.to);
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

export const activeCollections = (now = new Date()) => COLLECTIONS.filter((c) => isActive(c, now));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const windowLabel = (c: Collection) => `${MONTHS[c.from[0] - 1]} ${c.from[1]} to ${MONTHS[c.to[0] - 1]} ${c.to[1]}`;
