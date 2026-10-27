import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { setStorage } from '@/lib/server/storage';
import { createListing, deleteListing, PARTNER_TTL_MS, searchPartners, updateListing } from '@/lib/server/services/partners';
import { listSpots, removeSpot, shareSpot } from '@/lib/server/services/spots';
import { partnerSchema, spotSchema } from '@/lib/server/validation';

beforeEach(() => setStorage(new MemoryStorage()));

const listing = (over: Partial<Record<string, unknown>> = {}) =>
  partnerSchema.parse({ name: 'Ana', school: 'State U', courses: ['MATH 240', 'STAT400'], format: 'in-person', availability: 'Weeknights', contact: 'ana@example.edu', ...over });

describe('study partners', () => {
  it('finds listings by course code regardless of spaces and case, and hides the owner', async () => {
    await createListing(listing());
    await createListing(listing({ name: 'Ben', courses: ['CHEM131'], format: 'online' }));
    const found = await searchPartners({ school: 'state u', course: 'math240', format: '' });
    expect(found.map((l) => l.name)).toEqual(['Ana']);
    expect(found[0]).not.toHaveProperty('owner');
    expect((await searchPartners({ school: '', course: '', format: 'online' })).map((l) => l.name)).toEqual(['Ben']);
  });

  it('only lets the owner edit or delete', async () => {
    const { id, token } = await createListing(listing());
    await expect(updateListing(id, 'wrong', listing())).rejects.toThrow('own listing');
    await updateListing(id, token, listing({ note: 'Bring snacks' }));
    expect((await searchPartners({ school: '', course: '', format: '' }))[0].note).toBe('Bring snacks');
    await deleteListing(id, token);
    expect(await searchPartners({ school: '', course: '', format: '' })).toEqual([]);
  });

  it('expires listings after 30 days without an update', async () => {
    await createListing(listing());
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PARTNER_TTL_MS + 1000);
    expect(await searchPartners({ school: '', course: '', format: '' })).toEqual([]);
    vi.restoreAllMocks();
  });

  it('requires a course and a contact', () => {
    expect(() => listing({ courses: [] })).toThrow('at least one course');
    expect(() => listing({ contact: ' ' })).toThrow('reach you');
  });
});

describe('study spots', () => {
  it('shares and removes spots with the owner token only', async () => {
    const spot = spotSchema.parse({ name: ' Third floor ', lat: 38.98, lng: -76.94, note: '', tags: ['Quiet', 'Made up'], school: '' });
    expect(spot.name).toBe('Third floor');
    expect(spot.tags).toEqual(['Quiet']);
    const { id, token } = await shareSpot(spot);
    expect(await listSpots()).toHaveLength(1);
    await expect(removeSpot(id, 'nope')).rejects.toThrow('spots you shared');
    await removeSpot(id, token);
    expect(await listSpots()).toHaveLength(0);
  });

  it('rejects impossible coordinates', () => {
    expect(() => spotSchema.parse({ name: 'X', lat: 120, lng: 0, tags: [] })).toThrow();
  });
});
