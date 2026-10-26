import { z } from 'zod';

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
