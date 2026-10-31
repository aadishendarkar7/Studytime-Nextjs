/**
 * Chat word filter: masks swear words and slurs as ***.
 * Catches common disguises (f.u.c.k, sh1t, a$$) but leaves words that only
 * contain a bad word ("class", "assignment", "Scunthorpe") alone.
 */
const ROOTS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'twat', 'wanker', 'prick', 'motherfucker', 'bullshit',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'tranny', 'chink', 'spic', 'kike', 'dyke',
  'kys',
];
/** Endings that keep a word bad: fucking, shitty, bitches. */
const ENDINGS = '(?:s|es|ed|er|ers|ing|in|y|ty|head|face|hole)?';
const LEET: Record<string, string> = { a: 'a@4', e: 'e3', i: 'i1!|', o: 'o0', s: 's$5', t: 't7', g: 'g9', l: 'l1' };

const letter = (c: string) => `[${(LEET[c] ?? c).replace(/[\\\]^-]/g, '\\$&')}]`;
// Each letter may repeat (fuuuck) and may be split by dots, dashes, spaces or stars (f.u-c k).
const word = (root: string) => root.split('').map((c) => `${letter(c)}+`).join('[\\s._\\-*]?');
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(?:${ROOTS.map(word).join('|')})${ENDINGS}(?![\\p{L}\\p{N}])`, 'giu');

export function hasBadWords(text: string) {
  PATTERN.lastIndex = 0;
  return PATTERN.test(text);
}

export function maskBadWords(text: string) {
  return text.replace(PATTERN, (m) => m[0] + '*'.repeat(Math.max(2, m.replace(/[\s._\-]/g, '').length - 1)));
}
