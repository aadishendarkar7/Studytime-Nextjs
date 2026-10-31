import { describe, expect, it } from 'vitest';
import { parseGoogleDoc, previewUrl } from '@/features/study/google-docs';

describe('Google Docs links', () => {
  it('reads docs, sheets and slides links', () => {
    expect(parseGoogleDoc('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit?usp=sharing')).toEqual({ kind: 'document', id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345' });
    expect(parseGoogleDoc('https://docs.google.com/spreadsheets/u/1/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0')?.kind).toBe('spreadsheets');
    expect(parseGoogleDoc('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/')?.kind).toBe('presentation');
  });
  it('rejects other links', () => {
    expect(parseGoogleDoc('https://evil.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBeNull();
    expect(parseGoogleDoc('https://docs.google.com.evil.io/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBeNull();
    expect(parseGoogleDoc('not a link')).toBeNull();
  });
  it('builds an embeddable preview address', () => {
    expect(previewUrl({ kind: 'document', id: 'abc' })).toBe('https://docs.google.com/document/d/abc/preview');
  });
});
