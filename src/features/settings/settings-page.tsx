'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { AppearanceOptions } from '@/components/shell/appearance-picker';
import { clearLocalData, saveNow, signOut, useAccount } from '@/features/auth/account';
import { shareInvite } from '@/features/auth/invite-card';
import { api } from '@/lib/api';
import { NotificationSettings } from '@/features/planner/notifications';
import { useExtras } from '@/lib/stores/extras';
import { exportBackup, importBackup } from '@/lib/stores/hydrate';
import { toast } from '@/lib/stores/ui';
import { cn, downloadFile } from '@/lib/utils';
import { AiSettings } from './ai-settings';

function AppearanceCard() {
  return (
    <Card>
      <CardHeader title="Appearance" />
      <AppearanceOptions />
    </Card>
  );
}

function NotificationsCard() {
  const x = useExtras();
  return (
    <Card>
      <CardHeader title="Notifications" description="Reminders for deadlines, study blocks, water breaks and friends' drops." />
      <NotificationSettings />
      <Checkbox label="Tell me when friends drop a spot" checked={!x.dropQuiet} onChange={(e) => x.update({ dropQuiet: !e.target.checked })} />
      <Checkbox label="Water reminders every half hour" checked={x.waterRemind} onChange={(e) => x.update({ waterRemind: e.target.checked })} />
      <Checkbox label="Pop quiz from my flashcards after sessions" checked={x.popQuiz} onChange={(e) => x.update({ popQuiz: e.target.checked })} />
      <div className="mt-4 border-t border-line pt-4">
        <Checkbox label="Quiet hours" checked={x.quiet.on} onChange={(e) => x.update({ quiet: { ...x.quiet, on: e.target.checked } })} />
        <div className={cn('mt-2 flex flex-wrap items-center gap-2 pl-6 text-[13px]', !x.quiet.on && 'opacity-50')}>
          <span className="text-muted">From</span>
          <Input type="time" aria-label="Quiet hours start" className="h-9 w-[120px]" disabled={!x.quiet.on} value={x.quiet.from} onChange={(e) => x.update({ quiet: { ...x.quiet, from: e.target.value } })} />
          <span className="text-muted">to</span>
          <Input type="time" aria-label="Quiet hours end" className="h-9 w-[120px]" disabled={!x.quiet.on} value={x.quiet.to} onChange={(e) => x.update({ quiet: { ...x.quiet, to: e.target.value } })} />
        </div>
        <p className="mt-1.5 pl-6 text-[12px] text-muted">No water breaks, pop quizzes, nudges or message alerts. Deadline reminders and your own timer still come through.</p>
      </div>
    </Card>
  );
}

function AccountCard() {
  const user = useAccount((s) => s.user);
  const savedAt = useAccount((s) => s.savedAt);
  const saving = useAccount((s) => s.saving);
  const [dialog, setDialog] = useState<'' | 'password' | 'delete' | 'blocked'>('');
  if (!user) return null;
  return (
    <Card>
      <CardHeader title="Account" description={`Signed in as ${user.email}${user.viaGoogle ? ' with Google' : ''}.`} />
      <p className="text-[14px] text-ink-2">Your progress is saved to your account, so it shows up when you sign in on your phone or another computer.</p>
      <p className="mt-1 text-[13px] text-muted">{saving ? 'Saving…' : savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Saves a couple of minutes after changes.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => saveNow().then(() => toast('Saved to your account.'))}>Save now</Button>
        <Button variant="secondary" onClick={() => void shareInvite(user.id, user.name)}><Icon name="send" className="size-4" /> Invite friends</Button>
        <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
      </div>
      <div className="mt-5 grid gap-2 border-t border-line pt-4">
        <Checkbox label="Email me a short recap of my week on Sundays" checked={user.recapEmail} onChange={(e) => api.auth.profile({ recapEmail: e.target.checked }).then((r) => useAccount.setState({ user: r.user }), () => toast('Could not save.', 'error'))} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => setDialog('password')}>{user.hasPassword ? 'Change password' : 'Add a password'}</button>
          <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => setDialog('blocked')}>Blocked people</button>
          <button type="button" className="font-medium text-danger hover:underline" onClick={() => setDialog('delete')}>Delete account</button>
        </div>
      </div>
      {dialog === 'password' && <PasswordDialog hasPassword={user.hasPassword} onClose={() => setDialog('')} />}
      {dialog === 'delete' && <DeleteDialog hasPassword={user.hasPassword} onClose={() => setDialog('')} />}
      {dialog === 'blocked' && <BlockedDialog onClose={() => setDialog('')} />}
    </Card>
  );
}

function PasswordDialog({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} title={hasPassword ? 'Change password' : 'Add a password'}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api.auth.password(current, next);
          useAccount.setState({ user: r.user });
          toast('Password saved. Your other devices were signed out.');
          onClose();
        } catch (err) {
          toast((err as Error).message, 'error');
          setBusy(false);
        }
      }}>
        {hasPassword && <Field label="Current password" htmlFor="pwCur"><Input id="pwCur" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>}
        <Field label="New password" hint="At least 8 characters" htmlFor="pwNew"><Input id="pwNew" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Button type="submit" className="mt-5" loading={busy}>Save password</Button>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} title="Delete your account">
      <p className="text-[14px] text-ink-2">This deletes your account, your saved progress, your highlights and who you follow. It cannot be undone. Data saved only in this browser is cleared too.</p>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.auth.deleteAccount(hasPassword ? { password: value } : { confirm: value });
          clearLocalData();
          location.href = '/signin';
        } catch (err) {
          toast((err as Error).message, 'error');
          setBusy(false);
        }
      }}>
        <Field label={hasPassword ? 'Your password' : 'Type DELETE to confirm'} htmlFor="delConfirm"><Input id="delConfirm" type={hasPassword ? 'password' : 'text'} required value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        <div className="mt-5 flex gap-2">
          <Button type="submit" variant="danger" loading={busy}>Delete forever</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

function BlockedDialog({ onClose }: { onClose: () => void }) {
  const [people, setPeople] = useState<{ id: string; name: string; school: string }[] | null>(null);
  useEffect(() => {
    api.people.blocked().then((r) => setPeople(r.people), () => setPeople([]));
  }, []);
  return (
    <Dialog open onClose={onClose} title="Blocked people">
      {people === null ? <p className="text-[13px] text-muted">Loading</p> : people.length ? (
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{p.name}</span><span className="block text-[12px] text-muted">{p.school}</span></span>
              <Button size="sm" variant="secondary" onClick={() => api.people.block(p.id, false).then(() => setPeople(people.filter((x) => x.id !== p.id)))}>Unblock</Button>
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-muted">You have not blocked anyone.</p>}
    </Dialog>
  );
}

function DataCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader title="Backup and restore" description="Your progress is saved in this browser. Export a backup to move it to another device." />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadFile(`studytime-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(), 'application/json')}><Icon name="download" className="size-4" /> Export backup</Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" className="size-4" /> Import backup</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !confirm('Replace the progress in this browser with this backup?')) return;
            try {
              await importBackup(await f.text());
              toast('Backup restored.');
            } catch (error) {
              toast((error as Error).message, 'error');
            }
          }}
        />
      </div>
      <Note>Backups never include your API keys.</Note>
    </Card>
  );
}

export function SettingsPage() {
  useEffect(() => {
    if (location.hash === '#ai') setTimeout(() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <AccountCard />
          <AppearanceCard />
          <NotificationsCard />
          <DataCard />
        </div>
        <AiSettings />
      </div>
    </>
  );
}
