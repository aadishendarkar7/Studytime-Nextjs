import { z } from 'zod';
import { CATEGORIES } from '@/lib/types';
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

export const dropSchema = z.object({
  name: nameSchema,
  spotName: z.string().transform((v) => v.replace(/\s+/g, ' ').trim().slice(0, 80)).refine((v) => v.length > 0, 'Say where you are studying'),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  subject: text(60),
  note: text(200),
  startsAt: z.number(),
  endsAt: z.number(),
  audience: z.enum(['circle', 'school', 'everyone']),
  school: text(80),
  vibe: z.enum(['silent', 'quiet', 'group']).default('quiet'),
  seats: z.number().int().min(1).max(20).nullable().default(null),
  category: z.enum(CATEGORIES).catch('Anything goes').default('Anything goes'),
  circle: z.object({ code: z.string().max(8), memberId: z.string().max(32) }).nullable().optional(),
});

export const chatTextSchema = z.string().transform((v) => v.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000)).refine((v) => v.length > 0, 'Write a message first');
export const presenceSchema = z.object({
  name: nameSchema,
  school: text(80),
  major: text(60),
  year: text(20),
  courses: z.array(z.string().transform((v) => v.trim().slice(0, 40))).max(12).default([]),
  status: z.enum(['focusing', 'drop', 'online']).default('online'),
  statusText: text(80),
  visible: z.boolean().default(true),
  prompts: z.array(z.object({ q: z.string().max(80), a: z.string().transform((v) => v.trim().slice(0, 140)) })).max(3).default([]),
  style: text(40),
});

export const buddySchema = z.object({ name: nameSchema, course: text(60), task: text(80), school: text(80), endsAt: z.number() });
export const pactGoalSchema = z.coerce.number().int().min(60).max(3000);
export const eventSchema = z.object({
  host: nameSchema,
  title: z.string().transform((v) => v.replace(/\s+/g, ' ').trim().slice(0, 80)).refine((v) => v.length > 0, 'Give the event a title'),
  course: text(60),
  category: z.enum(CATEGORIES).catch('Anything goes'),
  place: z.string().transform((v) => v.replace(/\s+/g, ' ').trim().slice(0, 100)).refine((v) => v.length > 0, 'Say where it is'),
  startsAt: z.number(),
  endsAt: z.number(),
  capacity: z.number().int().min(2).max(200).nullable().default(null),
  school: text(80),
  audience: z.enum(['school', 'everyone']),
  note: text(300),
});
