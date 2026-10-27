import { describe, expect, it } from 'vitest';
import { cumulativeGpa, gradePoints, letterFor, neededForTarget, outlook, parseScore, termGpa } from '@/features/grades/logic';

const cat = (weight: number, score: number | null) => ({ id: String(Math.random()), name: 'x', weight, score });

describe('grade calculator', () => {
  it('parses percents and points', () => {
    expect(parseScore('88')).toBe(88);
    expect(parseScore('88%')).toBe(88);
    expect(parseScore('44/50')).toBe(88);
    expect(parseScore('')).toBeNull();
    expect(parseScore('abc')).toBeNull();
    expect(parseScore('4/0')).toBeNull();
  });

  it('finds the average needed on ungraded work', () => {
    // 40% graded at 90 locks in 36 points; 60 points remain; 90 overall needs 54/60 = 90%.
    const o = outlook([cat(40, 90), cat(60, null)], 90);
    expect(o.current).toBe(90);
    expect(o.earned).toBeCloseTo(36);
    expect(o.needed).toBeCloseTo(90);
    expect(o.best).toBeCloseTo(96);
    expect(o.worst).toBeCloseTo(36);
  });

  it('handles weights that do not total 100 proportionally', () => {
    const o = outlook([cat(20, 100), cat(20, null)], 75);
    expect(o.needed).toBeCloseTo(50);
  });

  it('reports a finished class', () => {
    const o = outlook([cat(50, 80), cat(50, 100)], 90);
    expect(o.needed).toBeNull();
    expect(o.earned).toBeCloseTo(90);
  });

  it('maps percents to letters', () => {
    expect(letterFor(93)).toBe('A');
    expect(letterFor(89.9)).toBe('B+');
    expect(letterFor(10)).toBe('F');
  });
});

describe('GPA calculator', () => {
  const term = { id: 't', name: 'Fall', courses: [
    { id: 'a', name: 'MATH', credits: 4, grade: 'A' },
    { id: 'b', name: 'STAT', credits: 3, grade: 'B+' },
    { id: 'c', name: 'Seminar', credits: 1, grade: 'P' },
    { id: 'd', name: 'Blank', credits: 3, grade: '' },
  ] };

  it('weights by credits and skips P, W and blank grades', () => {
    const r = termGpa(term);
    expect(r.credits).toBe(7);
    expect(r.gpa).toBeCloseTo((4 * 4 + 3.3 * 3) / 7);
  });

  it('treats A+ as 4.0 unless the school uses 4.3', () => {
    expect(gradePoints('A+')).toBe(4);
    expect(gradePoints('A+', true)).toBe(4.3);
  });

  it('combines prior credits and computes a target', () => {
    const r = cumulativeGpa([term], { gpa: 3.5, credits: 30 });
    expect(r.credits).toBe(37);
    const need = neededForTarget(r, 3.6, 15)!;
    expect((r.points + need * 15) / 52).toBeCloseTo(3.6);
  });
});
