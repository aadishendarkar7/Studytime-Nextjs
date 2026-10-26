import type { Deck } from '@/lib/types';

const deck = (name: string, subject: string, pairs: [string, string][]): Deck => ({
  id: `starter-${name.toLowerCase().replace(/\W+/g, '-')}`,
  name,
  subject,
  cards: pairs.map(([front, back]) => ({ front, back })),
});

export const STARTER_DECKS: Deck[] = [
  deck('Study Skills', 'Learning', [['What is active recall?', 'Testing yourself from memory'], ['What is spaced practice?', 'Reviewing material over several days'], ['What should you do after a focus session?', 'Take a short break'], ['What is a useful first step for a big task?', 'Break it into smaller steps'], ['What helps you remember a concept?', 'Explain it in your own words'], ['What can help when you feel stuck?', 'Ask a classmate or instructor']]),
  deck('Cell Structure', 'Biology', [['Mitochondria', 'Site of cellular respiration; makes most of the cell’s ATP'], ['Ribosome', 'Builds proteins by translating mRNA'], ['Nucleus', 'Stores DNA and controls gene expression'], ['Rough ER', 'Ribosome-studded membranes that make and fold proteins'], ['Smooth ER', 'Makes lipids and detoxifies chemicals'], ['Golgi apparatus', 'Modifies, sorts, and packages proteins'], ['Lysosome', 'Digests macromolecules and worn-out organelles'], ['Chloroplast', 'Site of photosynthesis in plants and algae'], ['Cell membrane', 'Phospholipid bilayer that controls what enters and leaves'], ['Cell wall', 'Rigid outer layer in plants, fungi, and bacteria']]),
  deck('Derivative Rules', 'Calculus', [['d/dx [x^n]', 'n·x^(n−1)'], ['d/dx [sin x]', 'cos x'], ['d/dx [cos x]', '−sin x'], ['d/dx [tan x]', 'sec² x'], ['d/dx [e^x]', 'e^x'], ['d/dx [ln x]', '1/x'], ['d/dx [a^x]', 'a^x · ln a'], ['Product rule: d/dx [f·g]', 'f′g + fg′'], ['Quotient rule: d/dx [f/g]', '(f′g − fg′) / g²'], ['Chain rule: d/dx [f(g(x))]', 'f′(g(x)) · g′(x)']]),
  deck('Chemistry Essentials', 'Chemistry', [['Avogadro’s number', '6.022 × 10^23 particles per mole'], ['Ideal gas law', 'PV = nRT'], ['pH formula', 'pH = −log[H⁺]'], ['Neutral pH at 25 °C', '7'], ['Molarity', 'Moles of solute per liter of solution'], ['Ionic bond', 'Electrons transferred from a metal to a nonmetal'], ['Covalent bond', 'Electrons shared between nonmetals'], ['Isotopes', 'Same element and protons, different number of neutrons'], ['Exothermic reaction', 'Releases heat; ΔH is negative'], ['Catalyst', 'Lowers activation energy without being consumed']]),
  deck('Mechanics Formulas', 'Physics', [['Newton’s second law', 'F = ma'], ['Kinetic energy', 'KE = ½mv²'], ['Gravitational potential energy (near Earth)', 'PE = mgh'], ['Momentum', 'p = mv'], ['Work', 'W = Fd cos θ'], ['Power', 'P = W / t'], ['Acceleration due to gravity on Earth', 'About 9.8 m/s²'], ['Newton’s third law', 'Every action has an equal and opposite reaction'], ['Velocity with constant acceleration', 'v = v₀ + at'], ['Displacement with constant acceleration', 'x = v₀t + ½at²']]),
  deck('Statistics Basics', 'Statistics', [['Mean', 'Sum of the values divided by how many there are'], ['Median', 'Middle value of ordered data'], ['Standard deviation', 'Typical distance of values from the mean'], ['p-value', 'Chance of results this extreme if the null hypothesis is true'], ['Normal curve: share within 1 SD', 'About 68%'], ['Normal curve: share within 2 SD', 'About 95%'], ['Type I error', 'Rejecting a true null hypothesis (false positive)'], ['Type II error', 'Failing to reject a false null hypothesis (false negative)'], ['Correlation coefficient r', 'Strength and direction of a linear relationship, −1 to 1'], ['Sample', 'A subset of the population used to estimate its parameters']]),
  deck('Trigonometry Core', 'Math', [['sin θ (right triangle)', 'opposite / hypotenuse'], ['cos θ (right triangle)', 'adjacent / hypotenuse'], ['tan θ (right triangle)', 'opposite / adjacent'], ['Pythagorean identity', 'sin²θ + cos²θ = 1'], ['Law of Sines', 'a/sin A = b/sin B = c/sin C'], ['Law of Cosines', 'c² = a² + b² − 2ab·cos C'], ['sin 30°', '1/2'], ['cos 0°', '1'], ['tan 45°', '1'], ['180° in radians', 'π']]),
  deck('SAT Vocabulary', 'English', [['Ambivalent', 'Having mixed or conflicting feelings'], ['Benevolent', 'Kind and well-meaning'], ['Candid', 'Honest and direct'], ['Diligent', 'Careful and hard-working'], ['Ephemeral', 'Lasting a very short time'], ['Meticulous', 'Very careful about details'], ['Pragmatic', 'Practical; focused on what works'], ['Scrutinize', 'Examine closely'], ['Tenacious', 'Persistent; not giving up easily'], ['Undermine', 'Weaken gradually or secretly']]),
];

/** Parse "term - answer", "term: answer", or tab-separated lines. */
export function parseBulkCards(text: string) {
  const cards: { front: string; back: string }[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split(/\t| — | – | - |\s*::\s*|:\s+/);
    if (parts.length < 2) continue;
    const front = parts[0].trim().slice(0, 180);
    const back = parts.slice(1).join(' - ').trim().slice(0, 180);
    if (front && back) cards.push({ front, back });
  }
  return cards;
}
