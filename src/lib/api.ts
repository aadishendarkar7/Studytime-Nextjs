'use client';
import type { BuddyView, FeedPost, PersonView, PostVisibility, EventInput, EventView, PactView, ChatChannelInfo, ChatMessage, ChatPerson, ChatStatus, ChatThread, CircleMemberView, ClassView, Deck, DropInput, DropView, LeaderboardResult, LeaderScope, PartnerInput, PartnerListing, PublicSpot, SpotInput } from './types';

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

export interface RoomView {
  code: string;
  name: string;
  me: string;
  group: { startsAt: number; endsAt: number; minutes: number; by: string } | null;
  members: { id: string; name: string; status: 'focusing' | 'break' | 'idle'; subject: string; endsAt: number | null; weekMinutes: number; weeklyGoal: number; online: boolean; lastSeen: number }[];
  kudos: { id: string; from: string; at: number }[];
}
export interface ImportedCalendar { kind: 'google' | 'canvas' | 'outlook' | 'apple' | 'other'; name: string; events: { uid: string; title: string; start: number; end: number; allDay: boolean; location: string }[] }

const chatHeaders = (token: string) => ({ 'X-Chat-Token': token });

export interface AccountView { id: string; email: string; name: string; createdAt: number; onboarded: boolean; hasPassword: boolean; viaGoogle: boolean; profile: { school: string; major: string; year: string; courses: string[] } }

export const api = {
  feed: {
    list: (scope: 'following' | 'school' | 'mine', before?: number) => request<{ posts: FeedPost[] }>(`/api/feed?scope=${scope}${before ? `&before=${before}` : ''}`),
    post: (body: { minutes: number; subject: string; topics: string[]; place: string; with: string[]; note: string; visibility: PostVisibility; at?: number }) => request<{ post: FeedPost }>('/api/feed', { method: 'POST', json: body }),
    remove: (id: string) => request<{ ok: true }>(`/api/feed/${enc(id)}`, { method: 'DELETE' }),
    kudos: (id: string) => request<{ post: FeedPost }>(`/api/feed/${enc(id)}/kudos`, { method: 'POST' }),
  },
  people: {
    search: (q: string) => request<{ people: PersonView[] }>(`/api/people?q=${encodeURIComponent(q)}`),
    get: (id: string) => request<{ person: PersonView; posts: FeedPost[] }>(`/api/people/${enc(id)}`),
    follow: (id: string, on: boolean) => request<{ ok: true }>(`/api/people/${enc(id)}/follow`, { method: on ? 'POST' : 'DELETE' }),
  },
  auth: {
    me: () => request<{ user: AccountView | null; google: boolean; domains: string[] }>('/api/auth/me'),
    signin: (email: string, password: string) => request<{ user: AccountView }>('/api/auth/signin', { method: 'POST', json: { email, password } }),
    signup: (name: string, email: string, password: string) => request<{ user: AccountView }>('/api/auth/signup', { method: 'POST', json: { name, email, password } }),
    signout: () => request<{ ok: true }>('/api/auth/signout', { method: 'POST' }),
    profile: (body: { name?: string; school?: string; major?: string; year?: string; courses?: string[]; onboarded?: boolean }) => request<{ user: AccountView }>('/api/auth/profile', { method: 'PUT', json: body }),
    getData: () => request<{ data: string | null; at: number }>('/api/auth/data'),
    putData: (data: string) => request<{ ok: true; at: number }>('/api/auth/data', { method: 'PUT', json: { data } }),
  },
  buddy: {
    join: (body: { name: string; course: string; task: string; school: string; endsAt: number }) => request<{ id: string; token: string }>('/api/buddy', { method: 'POST', json: body }),
    poll: (id: string, token: string) => request<{ me: BuddyView; buddy: BuddyView | null; sameCourse: boolean }>(`/api/buddy/${enc(id)}`, { headers: { 'X-Buddy-Token': token } }),
    status: (id: string, token: string, status: 'done' | 'left') => request<{ ok: true }>(`/api/buddy/${enc(id)}`, { method: 'PATCH', headers: { 'X-Buddy-Token': token }, json: { status } }),
  },
  pacts: {
    create: (name: string, goal: number) => request<{ code: string; memberId: string; token: string }>('/api/pacts', { method: 'POST', json: { name, goal } }),
    join: (code: string, name: string) => request<{ memberId: string; token: string; pact: PactView }>(`/api/pacts/${enc(code)}/join`, { method: 'POST', json: { name } }),
    report: (code: string, memberId: string, token: string, body: { name: string; minutes: number; goal?: number }) => request<PactView>(`/api/pacts/${enc(code)}`, { method: 'PUT', headers: { 'X-Pact-Token': token }, json: { memberId, ...body } }),
    leave: (code: string, memberId: string, token: string) => request<{ ok: true }>(`/api/pacts/${enc(code)}`, { method: 'DELETE', headers: { 'X-Pact-Token': token }, json: { memberId } }),
  },
  events: {
    list: (school: string) => request<{ events: EventView[] }>(`/api/events?school=${enc(school)}`),
    create: (body: EventInput) => request<{ id: string; token: string }>('/api/events', { method: 'POST', json: body }),
    rsvp: (id: string, name: string) => request<{ rsvpId: string; token: string; event: EventView }>(`/api/events/${enc(id)}/rsvp`, { method: 'POST', json: { name } }),
    cancel: (id: string, rsvpId: string, token: string) => request<EventView>(`/api/events/${enc(id)}/rsvp`, { method: 'DELETE', headers: { 'X-Rsvp-Token': token }, json: { rsvpId } }),
    remove: (id: string, token: string) => request<{ ok: true }>(`/api/events/${enc(id)}`, { method: 'DELETE', headers: { 'X-Event-Token': token } }),
  },
  chat: {
    register: () => request<{ token: string; id: string }>('/api/chat/register', { method: 'POST' }),
    presence: (token: string, body: { name: string; school: string; major: string; year: string; courses: string[]; status: ChatStatus; statusText: string; visible: boolean; prompts: { q: string; a: string }[]; style: string }) =>
      request<{ id: string }>('/api/chat/presence', { method: 'PUT', headers: chatHeaders(token), json: body }),
    online: (token: string) => request<{ users: ChatPerson[]; total: number }>('/api/chat/online', { headers: chatHeaders(token) }),
    inbox: (token: string, channels: string[]) => request<{ threads: ChatThread[]; last: Record<string, ChatChannelInfo> }>(`/api/chat/inbox?ch=${enc(channels.join(','))}`, { headers: chatHeaders(token) }),
    messages: (token: string, channel: string, after = 0) => request<{ messages: ChatMessage[] }>(`/api/chat/channels/${enc(channel)}?after=${after}`, { headers: chatHeaders(token) }),
    post: (token: string, channel: string, text: string) => request<ChatMessage>(`/api/chat/channels/${enc(channel)}`, { method: 'POST', headers: chatHeaders(token), json: { text } }),
    remove: (token: string, channel: string, id: string) => request<{ ok: true }>(`/api/chat/channels/${enc(channel)}/messages/${enc(id)}`, { method: 'DELETE', headers: chatHeaders(token) }),
    person: (token: string, id: string) => request<{ person: ChatPerson; online: boolean }>(`/api/chat/people/${enc(id)}`, { headers: chatHeaders(token) }),
    report: (token: string, channel: string, messageId: string, reason: string) => request<{ ok: true }>('/api/chat/report', { method: 'POST', headers: chatHeaders(token), json: { channel, messageId, reason } }),
  },
  drops: {
    list: (school: string, circle: { code: string; memberId: string } | null) =>
      request<{ drops: DropView[] }>(`/api/drops?school=${enc(school)}&circle=${enc(circle?.code ?? '')}`, { headers: circle ? { 'X-Circle-Member': circle.memberId } : {} }),
    create: (body: DropInput & { circle: { code: string; memberId: string } | null }) => request<{ id: string; token: string }>('/api/drops', { method: 'POST', json: body }),
    end: (id: string, token: string) => request<{ ok: true }>(`/api/drops/${enc(id)}`, { method: 'DELETE', headers: { 'X-Drop-Token': token } }),
    extend: (id: string, token: string, endsAt: number) => request<DropView>(`/api/drops/${enc(id)}`, { method: 'PATCH', headers: { 'X-Drop-Token': token }, json: { endsAt } }),
    join: (id: string, name: string) => request<{ joinerId: string; token: string }>(`/api/drops/${enc(id)}/join`, { method: 'POST', json: { name } }),
    leave: (id: string, joinerId: string, token: string) => request<{ ok: true }>(`/api/drops/${enc(id)}/join`, { method: 'DELETE', headers: { 'X-Join-Token': token }, json: { joinerId } }),
    status: (id: string, joinerId: string, token: string, status: 'coming' | 'here') => request<DropView>(`/api/drops/${enc(id)}/join`, { method: 'PATCH', headers: { 'X-Join-Token': token }, json: { joinerId, status } }),
    get: (id: string) => request<{ drop: DropView }>(`/api/drops/${enc(id)}`),
    message: (id: string, name: string, text: string, ownerToken: string | null) => request<DropView>(`/api/drops/${enc(id)}/messages`, { method: 'POST', headers: ownerToken ? { 'X-Drop-Token': ownerToken } : {}, json: { name, text } }),
  },
  calendar: {
    import: (url: string) => request<ImportedCalendar>('/api/calendar/import', { method: 'POST', json: { url } }),
    saveFeed: (token: string | null, events: { uid: string; title: string; start: number; end: number; allDay: boolean; description: string }[]) =>
      request<{ token: string }>('/api/calendar/feed', { method: 'PUT', json: { token, events } }),
    deleteFeed: (token: string) => request<{ ok: true }>('/api/calendar/feed', { method: 'DELETE', json: { token } }),
  },
  rooms: {
    create: (room: string, name: string) => request<{ code: string; memberId: string }>('/api/rooms', { method: 'POST', json: { room, name } }),
    join: (code: string, name: string) => request<{ memberId: string }>(`/api/rooms/${enc(code)}/join`, { method: 'POST', json: { name } }),
    beat: (code: string, memberId: string, body: { name: string; status: 'focusing' | 'break' | 'idle'; subject: string; endsAt: number | null; weekMinutes: number; weeklyGoal: number; since: number }) =>
      request<RoomView>(`/api/rooms/${enc(code)}/members/${enc(memberId)}`, { method: 'PUT', json: body }),
    leave: (code: string, memberId: string) => request<{ ok: true }>(`/api/rooms/${enc(code)}/members/${enc(memberId)}`, { method: 'DELETE' }),
    group: (code: string, memberId: string, minutes: 15 | 30 | 60 | 90) => request<RoomView>(`/api/rooms/${enc(code)}/group`, { method: 'POST', json: { memberId, minutes } }),
    kudos: (code: string, memberId: string, to: string) => request<{ ok: true }>(`/api/rooms/${enc(code)}/kudos`, { method: 'POST', json: { memberId, to } }),
  },
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
    profile: (token: string, body: { name: string; school: string; major: string; year: string; minutes: number; drops: number }) =>
      request<{ id: string }>('/api/leaderboard/profile', { method: 'PUT', headers: { 'X-Leader-Token': token }, json: body }),
    scope: (token: string, scope: Exclude<LeaderScope, 'class'>) => request<LeaderboardResult>(`/api/leaderboard/${scope}`, { headers: { 'X-Leader-Token': token } }),
    classScope: (code: string, classToken: string) => request<LeaderboardResult>(`/api/leaderboard/class?code=${enc(code)}`, { headers: { 'X-Class-Token': classToken } }),
  },
  decks: {
    list: () => request<{ decks: Deck[] }>('/api/decks'),
    share: (body: { name: string; subject: string; author: string; cards: { front: string; back: string }[] }) => request<{ id: string }>('/api/decks', { method: 'POST', json: body }),
  },
};
