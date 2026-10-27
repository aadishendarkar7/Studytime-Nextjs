import { z } from 'zod';
import { SPOT_TAGS } from '@/lib/types';

export const nameSchema = z
  .string()
  .optional()
  .transform((v) => (v || '').trim().slice(0, 30) || 'Student');

export const cardsSchema = z
  .array(z.object({ front: z.string(), back: z.string() }))
  .max(500)
  .transform((cards) =>
    cards
      .slice(0, 200)
      .map((c) => ({ front: c.front.trim().slice(0, 180), back: c.back.trim().slice(0, 180) }))
      .filter((c) => c.front && c.back),
  );

export const minutesSchema = z.coerce
  .number()
  .catch(0)
  .transform((n) => Math.min(10080, Math.max(0, Math.floor(n || 0))));

export const circleCode = z.string().regex(/^[A-F0-9]{8}$/, 'Invite code not found');
export const classCode = z.string().regex(/^[A-F0-9]{6}$/, 'Class code not found');

const text = (max: number) => z.string().optional().transform((v) => (v || '').replace(/\s+/g, ' ').trim().slice(0, max));

export const partnerSchema = z.object({
  name: nameSchema,
  school: text(80),
  major: text(60),
  year: z.string().optional().transform((v) => (['1', '2', '3', '4', '5'].includes(String(v)) ? String(v) : '')),
  courses: z.array(z.string()).max(20).transform((list) => [...new Set(list.map((c) => c.replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean))].slice(0, 8)),
  format: z.enum(['in-person', 'online', 'either']),
  availability: text(120),
  contact: text(120),
  note: text(280),
}).refine((p) => p.courses.length > 0, 'Add at least one course').refine((p) => p.contact.length > 0, 'Add a way for partners to reach you');

export const spotSchema = z.object({
  name: z.string().transform((v) => v.replace(/\s+/g, ' ').trim().slice(0, 60)).refine((v) => v.length > 0, 'Name the spot'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: text(200),
  tags: z.array(z.string()).max(10).transform((t) => t.filter((x) => (SPOT_TAGS as readonly string[]).includes(x))),
  school: text(80),
});
