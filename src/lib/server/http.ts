import 'server-only';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

/** Wrap a route handler so thrown HttpErrors and validation errors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message || 'Invalid request' }, 400);
      console.error(error);
      return json({ error: 'Something went wrong on the server' }, 500);
    }
  };
}

/** Read and validate a JSON body with a size limit (bytes). */
export async function readJson<S extends z.ZodType>(request: Request, schema: S, limit = 20_000): Promise<z.infer<S>> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > limit) throw new HttpError(413, 'Request too large');
  const text = await request.text();
  if (text.length > limit) throw new HttpError(413, 'Request too large');
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
  return schema.parse(data);
}

export function clientIp(request: Request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
}
