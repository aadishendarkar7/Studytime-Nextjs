'use client';
import type { CircleMemberView, ClassView, Deck, LeaderboardResult, LeaderScope, PartnerInput, PartnerListing, PublicSpot, SpotInput } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(path, { ...rest, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? rest.body : JSON.stringify(json) });
  } catch {
    throw new ApiError('Could not reach Studytime. Check your connection.', 0);
  }
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error || `Request failed (${response.status})`, response.status);
  return body;
}

const enc = encodeURIComponent;

export const api = {
  partners: {
    search: (q: { school: string; course: string; format: string }) =>
      request<{ listings: PartnerListing[] }>(`/api/partners?school=${enc(q.school)}&course=${enc(q.course)}&format=${enc(q.format)}`),
    create: (body: PartnerInput) => request<{ id: string; token: string }>('/api/partners', { method: 'POST', json: body }),
    mine: (id: string, token: string) => request<PartnerListing>(`/api/partners/${enc(id)}`, { headers: { 'X-Partner-Token': token } }),
    update: (id: string, token: string, body: PartnerInput) => request<{ id: string }>(`/api/partners/${enc(id)}`, { method: 'PUT', headers: { 'X-Partner-Token': token }, json: body }),
    remove: (id: string, token: string) => request<{ ok: true }>(`/api/partners/${enc(id)}`, { method: 'DELETE', headers: { 'X-Partner-Token': token } }),
  },
  spots: {
    list: () => request<{ spots: PublicSpot[] }>('/api/spots'),
    share: (body: SpotInput) => request<{ id: string; token: string }>('/api/spots', { method: 'POST', json: body }),
    remove: (id: string, token: string) => request<{ ok: true }>(`/api/spots/${enc(id)}`, { method: 'DELETE', headers: { 'X-Spot-Token': token } }),
  },
  circles: {
    create: (name: string) => request<{ code: string; memberId: string; publicId: string }>('/api/circles', { method: 'POST', json: { name } }),
    join: (code: string, name: string) => request<{ memberId: string; publicId: string }>(`/api/circles/${enc(code)}/join`, { method: 'POST', json: { name } }),
    update: (code: string, memberId: string, body: { name: string; minutes: number; streak: number }) =>
      request<{ members: CircleMemberView[] }>(`/api/circles/${enc(code)}/members/${enc(memberId)}`, { method: 'PUT', json: body }),
  },
  classes: {
    create: (body: { name: string; setName: string; student: string; cards: { front: string; back: string }[] }) => request<{ code: string; token: string }>('/api/classes', { method: 'POST', json: body }),
    join: (code: string, name: string) => request<{ code: string; token: string }>(`/api/classes/${enc(code)}/join`, { method: 'POST', json: { name } }),
    view: (code: string, token: string) => request<ClassView>(`/api/classes/${enc(code)}`, { headers: { 'X-Class-Token': token } }),
    advance: (code: string, token: string) => request<ClassView>(`/api/classes/${enc(code)}/advance`, { method: 'POST', headers: { 'X-Class-Token': token }, json: {} }),
    answer: (code: string, token: string, choice: string) => request<ClassView>(`/api/classes/${enc(code)}/answer`, { method: 'POST', headers: { 'X-Class-Token': token }, json: { choice } }),
    progress: (code: string, token: string, minutes: number) => request<{ ok: true }>(`/api/classes/${enc(code)}/progress`, { method: 'PUT', headers: { 'X-Class-Token': token }, json: { minutes } }),
  },
  leaderboard: {
    register: () => request<{ token: string; id: string }>('/api/leaderboard/register', { method: 'POST', json: {} }),
    profile: (token: string, body: { name: string; school: string; major: string; year: string; minutes: number }) =>
      request<{ id: string }>('/api/leaderboard/profile', { method: 'PUT', headers: { 'X-Leader-Token': token }, json: body }),
    scope: (token: string, scope: Exclude<LeaderScope, 'class'>) => request<LeaderboardResult>(`/api/leaderboard/${scope}`, { headers: { 'X-Leader-Token': token } }),
    classScope: (code: string, classToken: string) => request<LeaderboardResult>(`/api/leaderboard/class?code=${enc(code)}`, { headers: { 'X-Class-Token': classToken } }),
  },
  decks: {
    list: () => request<{ decks: Deck[] }>('/api/decks'),
    share: (body: { name: string; subject: string; author: string; cards: { front: string; back: string }[] }) => request<{ id: string }>('/api/decks', { method: 'POST', json: body }),
  },
};
