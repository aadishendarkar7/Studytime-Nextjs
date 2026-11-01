/**
 * Arena questions. A match is a seed: the same seed always gives the same ten questions,
 * so two players (or a player and someone's earlier run) face exactly the same set.
 * Only the server imports this file, so the answers never reach the browser before you answer.
 */

import type { Topic } from './types';
export type { Topic };

export interface Question { prompt: string; choices: string[]; answer: number; topic: Exclude<Topic, 'mixed'> }
export const QUESTIONS_PER_MATCH = 10;
export const SECONDS_PER_QUESTION = 15;

/** Small, fast, seeded random numbers (mulberry32). */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length)];
function shuffle<T>(r: Rand, list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n: number, d: number) => {
  const g = gcd(n, d);
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
};

/** A question from a right answer and some wrong ones, in a shuffled order. */
function make(r: Rand, topic: Question['topic'], prompt: string, right: string, wrong: string[]): Question {
  const others = [...new Set(wrong.filter((w) => w !== right))].slice(0, 3);
  const choices = shuffle(r, [right, ...others]);
  return { prompt, choices, answer: choices.indexOf(right), topic };
}
/** Wrong numeric answers close to the right one, never equal to it. */
function near(r: Rand, right: number, spread: number[]) {
  const out = new Set<number>();
  for (const s of shuffle(r, spread)) {
    if (out.size === 3) break;
    if (right + s !== right && right + s >= 0) out.add(right + s);
  }
  let k = 1;
  while (out.size < 3) out.add(right + spread[0] * ++k);
  return [...out].map(String);
}

/** Math questions are generated, so there are endlessly many and every answer is computed, not typed. */
const MATH: ((r: Rand) => Question)[] = [
  (r) => {
    const a = int(r, 12, 49);
    const b = int(r, 3, 9);
    return make(r, 'math', `${a} × ${b} = ?`, String(a * b), near(r, a * b, [b, -b, 10, -10, 1]));
  },
  (r) => {
    const p = pick(r, [5, 10, 15, 20, 25, 30, 40, 75]);
    const n = int(r, 2, 16) * 20;
    const v = (p * n) / 100;
    return make(r, 'math', `What is ${p}% of ${n}?`, String(v), near(r, v, [5, -5, 10, -10, 2]));
  },
  (r) => {
    const a = int(r, 2, 9);
    const x = int(r, -6, 12);
    const b = int(r, 1, 20);
    const c = a * x + b;
    return make(r, 'math', `Solve for x: ${a}x + ${b} = ${c}`, String(x), [x + 1, x - 1, x + 2, -x].map(String));
  },
  (r) => {
    const k = int(r, 2, 12);
    const ways = 6 - Math.abs(7 - k);
    return make(r, 'math', `Two fair dice are rolled. What is the chance the total is ${k}?`, frac(ways, 36), [frac(ways + 1, 36), frac(Math.max(1, ways - 1) === ways ? ways + 2 : Math.max(1, ways - 1), 36), frac(1, 6), frac(1, 12), frac(1, 36)]);
  },
  (r) => {
    const n = int(r, 2, 5);
    return make(r, 'math', `A fair coin is flipped ${n} times. What is the chance of all heads?`, `1/${2 ** n}`, [`1/${2 * n}`, `1/${2 ** (n + 1)}`, `1/${n}`, `${n}/${2 ** n}`]);
  },
  (r) => {
    const xs = Array.from({ length: 5 }, () => int(r, 1, 20));
    const sum = xs.reduce((s, x) => s + x, 0);
    // Keep the mean a whole number.
    xs[4] += (5 - (sum % 5)) % 5;
    const mean = xs.reduce((s, x) => s + x, 0) / 5;
    return make(r, 'math', `Mean of ${xs.join(', ')}?`, String(mean), near(r, mean, [1, -1, 2, -2]));
  },
  (r) => {
    const xs = Array.from({ length: 5 }, () => int(r, 1, 30));
    const sorted = [...xs].sort((a, b) => a - b);
    const med = sorted[2];
    return make(r, 'math', `Median of ${xs.join(', ')}?`, String(med), [sorted[1], sorted[3], xs[2], Math.round(xs.reduce((s, x) => s + x, 0) / 5)].map(String));
  },
  (r) => {
    const a = int(r, 2, 6);
    const n = int(r, 2, 4);
    const x = int(r, 1, 3);
    const v = a * n * x ** (n - 1);
    return make(r, 'math', `If f(x) = ${a}x^${n}, what is f′(${x})?`, String(v), [a * x ** n, a * n * x ** n, a * (n - 1) * x ** (n - 1), v + a].map(String));
  },
  (r) => {
    const s = int(r, 2, 20);
    const d = int(r, 3, 9);
    const seq = [s, s + d, s + 2 * d, s + 3 * d];
    return make(r, 'math', `Next number: ${seq.join(', ')}, ...`, String(s + 4 * d), [s + 5 * d, s + 4 * d + 1, s + 3 * d + 2 * d - 1, s + 4 * d - d].map(String));
  },
  (r) => {
    const n = int(r, 4, 7);
    const k = 2;
    const v = (n * (n - 1)) / 2;
    return make(r, 'math', `How many ways to choose ${k} people from ${n}?`, String(v), [n * (n - 1), n * k, v + n, v - 1].map(String));
  },
  (r) => {
    const sq = int(r, 11, 25);
    return make(r, 'math', `√${sq * sq} = ?`, String(sq), near(r, sq, [1, -1, 2, 10]));
  },
];

/** Facts that do not change. Each was checked; the right answer is always listed first here. */
const BANK: [Question['topic'], string, string, string, string, string][] = [
  ['science', 'What is the powerhouse of the cell?', 'Mitochondria', 'Ribosome', 'Golgi apparatus', 'Nucleus'],
  ['science', 'Which gas do plants take in for photosynthesis?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'],
  ['science', 'What is the chemical symbol for sodium?', 'Na', 'So', 'S', 'Sd'],
  ['science', 'What is the chemical symbol for iron?', 'Fe', 'Ir', 'In', 'F'],
  ['science', 'How many chromosomes do most human cells have?', '46', '23', '48', '44'],
  ['science', 'Which part of the cell holds DNA in plants and animals?', 'Nucleus', 'Cell membrane', 'Cytoplasm', 'Vacuole'],
  ['science', 'What is the pH of pure water at 25°C?', '7', '0', '14', '5'],
  ['science', 'Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Mars', 'Earth'],
  ['science', 'What is the SI unit of force?', 'Newton', 'Joule', 'Watt', 'Pascal'],
  ['science', 'What is the SI unit of energy?', 'Joule', 'Newton', 'Watt', 'Volt'],
  ['science', 'Acceleration due to gravity near Earth is about…', '9.8 m/s²', '3.0 m/s²', '98 m/s²', '1.6 m/s²'],
  ['science', 'Which blood cells carry oxygen?', 'Red blood cells', 'White blood cells', 'Platelets', 'Plasma cells'],
  ['science', 'DNA bases pair as A with…', 'T', 'G', 'C', 'U'],
  ['science', 'Which base is found in RNA but not DNA?', 'Uracil', 'Thymine', 'Adenine', 'Guanine'],
  ['science', 'What type of bond shares electrons between atoms?', 'Covalent', 'Ionic', 'Metallic', 'Hydrogen'],
  ['science', 'Avogadro’s number is about…', '6.02 × 10²³', '3.00 × 10⁸', '6.63 × 10⁻³⁴', '1.60 × 10⁻¹⁹'],
  ['science', 'The speed of light in a vacuum is about…', '3 × 10⁸ m/s', '3 × 10⁶ m/s', '3 × 10⁵ m/s', '343 m/s'],
  ['science', 'Which organ makes insulin?', 'Pancreas', 'Liver', 'Kidney', 'Stomach'],
  ['science', 'What is the most abundant gas in Earth’s air?', 'Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'],
  ['science', 'Newton’s second law is…', 'F = ma', 'E = mc²', 'V = IR', 'PV = nRT'],
  ['science', 'Ohm’s law is…', 'V = IR', 'P = IV', 'F = ma', 'Q = mcΔT'],
  ['science', 'Which process splits one cell into two identical cells?', 'Mitosis', 'Meiosis', 'Osmosis', 'Fertilization'],
  ['science', 'An atom’s atomic number counts its…', 'Protons', 'Neutrons', 'Electrons and neutrons', 'Nucleons'],
  ['science', 'Which element has atomic number 6?', 'Carbon', 'Oxygen', 'Nitrogen', 'Helium'],
  ['science', 'What is the binary number 1010 in decimal?', '10', '5', '12', '8'],
  ['science', 'How many bits are in a byte?', '8', '4', '16', '10'],
  ['science', 'Binary search on a sorted list runs in…', 'O(log n)', 'O(n)', 'O(n log n)', 'O(1)'],
  ['science', 'Which data structure is last in, first out?', 'Stack', 'Queue', 'Heap', 'Linked list'],
  ['science', 'Which data structure is first in, first out?', 'Queue', 'Stack', 'Tree', 'Hash map'],
  ['science', 'What does HTML stand for?', 'HyperText Markup Language', 'High Transfer Machine Language', 'HyperText Main Logic', 'Home Tool Markup Language'],
  ['science', 'What does CPU stand for?', 'Central Processing Unit', 'Core Program Utility', 'Central Power Unit', 'Computer Processing Utility'],
  ['science', 'Average time to look up a key in a hash table is…', 'O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
  ['science', 'Merge sort’s running time is…', 'O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'],
  ['science', 'In Python, what does len("study") return?', '5', '4', '6', '"study"'],
  ['science', 'Which logic gate is true only when both inputs are true?', 'AND', 'OR', 'XOR', 'NOT'],
  ['science', 'Light bends when it passes from air into water. This is…', 'Refraction', 'Reflection', 'Diffraction', 'Dispersion'],
  ['science', 'What is the hardest natural material?', 'Diamond', 'Quartz', 'Granite', 'Iron'],
  ['science', 'Which organelle does photosynthesis?', 'Chloroplast', 'Mitochondrion', 'Ribosome', 'Lysosome'],
  ['math', 'In statistics, a p-value below 0.05 usually means…', 'Reject the null at the 5% level', 'The null is true', 'The effect is large', 'The sample is too small'],
  ['math', 'Which measure is most affected by outliers?', 'Mean', 'Median', 'Mode', 'Interquartile range'],
  ['math', 'About what share of a normal distribution is within 1 SD of the mean?', '68%', '50%', '95%', '99.7%'],
  ['math', 'About what share of a normal distribution is within 2 SD of the mean?', '95%', '68%', '90%', '99.7%'],
  ['math', 'Correlation values always fall between…', '−1 and 1', '0 and 1', '0 and 100', '−∞ and ∞'],
  ['math', 'The derivative of sin(x) is…', 'cos(x)', '−cos(x)', '−sin(x)', 'tan(x)'],
  ['math', 'The derivative of eˣ is…', 'eˣ', 'xeˣ⁻¹', 'ln(x)', '1/x'],
  ['math', 'The derivative of ln(x) is…', '1/x', 'eˣ', 'x', 'ln(x)/x'],
  ['math', 'The integral of 1/x dx is…', 'ln|x| + C', 'x⁻² + C', 'eˣ + C', '1/x² + C'],
  ['math', 'The determinant of the 2×2 identity matrix is…', '1', '0', '2', '4'],
  ['math', 'A matrix has an inverse exactly when its determinant is…', 'Not zero', 'Zero', 'Positive', 'One'],
  ['math', 'What is 0! (zero factorial)?', '1', '0', 'Undefined', '10'],
  ['math', 'What is log₁₀(1000)?', '3', '10', '100', '30'],
  ['math', 'The sum of angles in a triangle is…', '180°', '360°', '90°', '270°'],
  ['math', 'The area of a circle with radius r is…', 'πr²', '2πr', 'πd', '2πr²'],
  ['math', 'Independent events A and B: P(A and B) equals…', 'P(A) × P(B)', 'P(A) + P(B)', 'P(A) − P(B)', 'P(A | B) + P(B)'],
  ['general', 'When price rises and demand falls, that follows the law of…', 'Demand', 'Supply', 'Diminishing returns', 'Comparative advantage'],
  ['general', 'GDP measures…', 'The value of goods and services a country produces', 'A country’s debt', 'Money in circulation', 'Exports minus imports'],
  ['general', 'A general rise in prices over time is called…', 'Inflation', 'Deflation', 'Recession', 'Depreciation'],
  ['general', 'The US central bank is the…', 'Federal Reserve', 'Treasury', 'SEC', 'FDIC'],
  ['general', 'What you give up to choose something else is the…', 'Opportunity cost', 'Sunk cost', 'Marginal cost', 'Fixed cost'],
  ['general', 'A market with one seller is a…', 'Monopoly', 'Oligopoly', 'Monopsony', 'Perfect competition'],
  ['general', 'In which year did World War II end?', '1945', '1939', '1918', '1950'],
  ['general', 'The US Declaration of Independence was adopted in…', '1776', '1789', '1812', '1607'],
  ['general', 'Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Homer'],
  ['general', 'The first ten amendments to the US Constitution are the…', 'Bill of Rights', 'Federalist Papers', 'Articles of Confederation', 'Magna Carta'],
  ['general', 'How many members are in the US Senate?', '100', '435', '50', '538'],
  ['general', 'The Berlin Wall fell in…', '1989', '1961', '1991', '1975'],
  ['general', 'Which empire built Machu Picchu?', 'Inca', 'Aztec', 'Maya', 'Olmec'],
  ['general', 'Which is the largest ocean?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'],
  ['general', 'What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
  ['general', 'What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
  ['general', '"Ubiquitous" means…', 'Found everywhere', 'Very rare', 'Hard to see', 'Old-fashioned'],
  ['general', '"Ephemeral" means…', 'Lasting a short time', 'Lasting forever', 'Very large', 'Easy to break'],
  ['general', '"Pragmatic" means…', 'Practical', 'Dreamy', 'Stubborn', 'Talkative'],
  ['general', '"Benevolent" means…', 'Kind', 'Angry', 'Lazy', 'Proud'],
  ['general', 'A word that means the opposite of another is an…', 'Antonym', 'Synonym', 'Homonym', 'Acronym'],
  ['general', 'Comparing two things using "like" or "as" is a…', 'Simile', 'Metaphor', 'Hyperbole', 'Alliteration'],
  ['general', 'Which language has the most native speakers?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi'],
  ['general', 'The Magna Carta was signed in…', '1215', '1066', '1492', '1688'],
  ['general', 'Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Vincent van Gogh'],
  ['general', 'The study of how people make choices with limited resources is…', 'Economics', 'Sociology', 'Psychology', 'Anthropology'],
];

function fromBank(r: Rand, item: (typeof BANK)[number]): Question {
  const [topic, prompt, right, ...wrong] = item;
  return make(r, topic, prompt, right, wrong);
}

/** The ten questions for a seed and topic. Same inputs, same questions, same order. */
export function questionsFor(seed: string, topic: Topic = 'mixed'): Question[] {
  const r = rng(`${seed}:${topic}`);
  const bank = shuffle(r, BANK.filter(([t]) => topic === 'mixed' || t === topic));
  const out: Question[] = [];
  const seen = new Set<string>();
  let b = 0;
  let mathTurn = 0;
  for (let i = 0; out.length < QUESTIONS_PER_MATCH && i < 200; i++) {
    // Math is generated; other topics come from the bank. Mixed alternates roughly 40/60.
    const useMath = topic === 'math' ? r() < 0.6 || b >= bank.length : topic === 'mixed' ? r() < 0.4 : false;
    const q = useMath ? MATH[(mathTurn++ + int(r, 0, MATH.length - 1)) % MATH.length](r) : bank[b] ? fromBank(r, bank[b++]) : null;
    if (!q || seen.has(q.prompt) || q.choices.length < 4) continue;
    seen.add(q.prompt);
    out.push(q);
  }
  return out;
}
