import 'server-only';
import { z } from 'zod';

export const roomCode = z.string().transform((v) => v.toUpperCase()).pipe(z.string().regex(/^[A-F0-9]{6}$/, 'Room code not found'));
export const roomMember = z.string().regex(/^[a-f0-9]{32}$/, 'You are not in this room');
