import type { GpaTerm, GradeCategory } from '@/lib/stores/extras';

/** Common US letter cutoffs. Many syllabi use these; the target field is editable for ones that don't. */
export const LETTER_CUTOFFS: { letter: string; min: number }[] = [
  { letter: 'A+', min: 97 }, { letter: 'A', min: 93 }, { letter: 'A-', min: 90 },
  { letter: 'B+', min: 87 }, { letter: 'B', min: 83 }, { letter: 'B-', min: 80 },
  { letter: 'C+', min: 77 }, { letter: 'C', min: 73 }, { letter: 'C-', min: 70 },
  { letter: 'D+', min: 67 }, { letter: 'D', min: 63 }, { letter: 'D-', min: 60 },
];

export const letterFor = (pct: number) => LETTER_CUTOFFS.find((c) => pct >= c.min)?.letter ?? 'F';

/** Grade points on a 4.0 scale. With plusCountsHigher an A+ is 4.3, as some schools use. */
export function gradePoints(grade: string, plusCountsHigher = false): number | null {
  const table: Record<string, number> = {
    'A+': plusCountsHigher ? 4.3 : 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
    'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0,
  };
  return grade in table ? table[grade] : null;
}

export const GPA_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'W'];

/**
 * Reads a score typed as a percent ("88", "88%") or as points ("44/50").
 * Returns a percent, or null when the text is empty or not a score.
 */
export function parseScore(text: string): number | null {
  const t = text.trim().replace('%', '');
  if (!t) return null;
  const frac = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const [, a, b] = frac;
    return Number(b) > 0 ? (Number(a) / Number(b)) * 100 : null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface GradeOutlook {
  totalWeight: number;
  gradedWeight: number;
  /** Weighted average of graded categories only, or null if nothing is graded. */
  current: number | null;
  /** Points already locked in toward the final grade, out of 100. */
  earned: number;
  /** Average needed on everything not graded yet to reach the target, or null if nothing is left. */
  needed: number | null;
  /** Final grade if every ungraded category scores 100, and if each scores 0. */
  best: number;
  worst: number;
}

export function outlook(categories: GradeCategory[], target: number): GradeOutlook {
  const totalWeight = categories.reduce((a, c) => a + Math.max(0, c.weight), 0);
  const graded = categories.filter((c) => c.score !== null && c.weight > 0);
  const gradedWeight = graded.reduce((a, c) => a + c.weight, 0);
  const scale = totalWeight > 0 ? 100 / totalWeight : 0; // weights that do not add to 100 are treated proportionally
  const earned = graded.reduce((a, c) => a + c.weight * (c.score as number), 0) * scale / 100;
  const remaining = (totalWeight - gradedWeight) * scale;
  return {
    totalWeight,
    gradedWeight,
    current: gradedWeight > 0 ? graded.reduce((a, c) => a + c.weight * (c.score as number), 0) / gradedWeight : null,
    earned,
    needed: remaining > 0 ? ((target - earned) / remaining) * 100 : null,
    best: earned + remaining,
    worst: earned,
  };
}

export interface GpaResult { gpa: number | null; credits: number; points: number }

export function termGpa(term: GpaTerm, plusCountsHigher = false): GpaResult {
  let credits = 0;
  let points = 0;
  for (const c of term.courses) {
    const gp = gradePoints(c.grade, plusCountsHigher);
    if (gp === null || !(c.credits > 0)) continue; // P and W do not count toward GPA
    credits += c.credits;
    points += gp * c.credits;
  }
  return { gpa: credits ? points / credits : null, credits, points };
}

export function cumulativeGpa(terms: GpaTerm[], prior: { gpa: number | null; credits: number }, plusCountsHigher = false): GpaResult {
  let credits = prior.gpa !== null && prior.credits > 0 ? prior.credits : 0;
  let points = credits ? (prior.gpa as number) * credits : 0;
  for (const t of terms) {
    const r = termGpa(t, plusCountsHigher);
    credits += r.credits;
    points += r.points;
  }
  return { gpa: credits ? points / credits : null, credits, points };
}

/** Average GPA needed over `futureCredits` more credits to reach `target`. */
export function neededForTarget(current: GpaResult, target: number, futureCredits: number): number | null {
  if (!(futureCredits > 0)) return null;
  return (target * (current.credits + futureCredits) - current.points) / futureCredits;
}
