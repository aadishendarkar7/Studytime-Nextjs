import { describe, expect, it } from 'vitest';
import { hasBadWords, maskBadWords } from '@/lib/word-filter';

describe('chat word filter', () => {
  it('masks swear words and common disguises', () => {
    expect(maskBadWords('this is shit')).toBe('this is s***');
    expect(maskBadWords('what the FUCKING hell')).toBe('what the F****** hell');
    expect(hasBadWords('f.u.c.k this')).toBe(true);
    expect(hasBadWords('sh1t')).toBe(true);
    expect(hasBadWords('a$$hole')).toBe(true);
    expect(hasBadWords('fuuuuck')).toBe(true);
  });
  it('leaves normal words alone', () => {
    for (const ok of ['class assignment', 'Scunthorpe', 'cockpit', 'shitake', 'bass', 'grape', 'Dickens', 'peacock', 'skills']) expect(hasBadWords(ok)).toBe(false);
    expect(maskBadWords('see you at the library')).toBe('see you at the library');
  });
});
