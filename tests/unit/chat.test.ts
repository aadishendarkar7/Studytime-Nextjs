import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { setStorage } from '@/lib/server/storage';
import { dmChannel, heartbeat, inbox, messages, online, person, post, register, removeMessage, report, slug } from '@/lib/server/services/chat';

beforeEach(() => setStorage(new MemoryStorage()));
const presence = (name: string, visible = true) => ({ name, school: 'UMD', major: 'Math', year: '2', courses: ['STAT400'], status: 'online' as const, statusText: '', visible, prompts: [], style: '' });

describe('chat', () => {
  it('needs a registered token', async () => {
    await expect(online(null)).rejects.toThrow('chat profile');
    await expect(online('a'.repeat(48))).rejects.toThrow('not found');
  });

  it('lists people who are online and visible', async () => {
    const a = await register();
    const b = await register();
    const c = await register();
    await heartbeat(a.token, presence('Ana'));
    await heartbeat(b.token, presence('Ben'));
    await heartbeat(c.token, presence('Cy', false));
    const { users } = await online(a.token);
    expect(users.map((u) => u.name)).toEqual(['Ana', 'Ben']);
    expect(users[0]).not.toHaveProperty('visible');
    expect((await person(a.token, b.id)).online).toBe(true);
  });

  it('posts to channels, keeps DMs private, and fills both inboxes', async () => {
    const a = await register();
    const b = await register();
    const c = await register();
    await heartbeat(a.token, presence('Ana'));
    await heartbeat(b.token, presence('Ben'));
    await post(a.token, 'general', 'hi all');
    await post(b.token, `s-${slug('UMD')}`, 'anyone at McKeldin?');
    expect((await messages(c.token, 'general')).messages.map((m) => m.text)).toEqual(['hi all']);
    const dm = dmChannel(a.id, b.id);
    await post(a.token, dm, 'want to study for STAT400?');
    await expect(messages(c.token, dm)).rejects.toThrow('private');
    expect((await messages(b.token, dm)).messages[0].name).toBe('Ana');
    const ib = await inbox(b.token, ['general', 's-umd']);
    expect(ib.threads[0]).toMatchObject({ with: a.id, name: 'Ana', fromMe: false });
    expect(Object.keys(ib.last).sort()).toEqual(['general', 's-umd']);
    expect((await inbox(a.token, [])).threads[0]).toMatchObject({ with: b.id, name: 'Ben', fromMe: true });
  });

  it('only lets you delete your own messages, and takes reports', async () => {
    const a = await register();
    const b = await register();
    const m = await post(a.token, 'general', 'oops');
    await expect(removeMessage(b.token, 'general', m.id)).rejects.toThrow('own');
    await report(b.token, 'general', m.id, 'spam');
    await removeMessage(a.token, 'general', m.id);
    expect((await messages(a.token, 'general')).messages).toEqual([]);
    await expect(post(a.token, 'not a channel', 'x')).rejects.toThrow('not found');
  });
});
