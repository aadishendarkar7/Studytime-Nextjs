import { describe, expect, it } from 'vitest';
import { activeCollections, COLLECTIONS, isActive } from '@/features/games/collections';

describe('special collections', () => {
  const at = (m: number, d: number) => new Date(2026, m - 1, d, 12);
  it('shows the right packs for the date', () => {
    expect(activeCollections(at(10, 31)).map((c) => c.id)).toContain('halloween');
    expect(activeCollections(at(12, 10)).map((c) => c.id)).toEqual(['finals-fall']);
    expect(activeCollections(at(7, 4))).toEqual([]);
  });
  it('handles windows that wrap the new year', () => {
    const ny = COLLECTIONS.find((c) => c.id === 'new-year')!;
    expect(isActive(ny, at(12, 30))).toBe(true);
    expect(isActive(ny, at(1, 15))).toBe(true);
    expect(isActive(ny, at(2, 15))).toBe(false);
  });
  it('has unique deck ids with cards', () => {
    const ids = COLLECTIONS.flatMap((c) => c.decks.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COLLECTIONS) for (const d of c.decks) expect(d.cards.length).toBeGreaterThanOrEqual(5);
  });
});
