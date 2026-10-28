'use client';
import { useEffect, useRef } from 'react';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { AppearanceOptions } from '@/components/shell/appearance-picker';
import { NotificationSettings } from '@/features/planner/notifications';
import { useExtras } from '@/lib/stores/extras';
import { exportBackup, importBackup } from '@/lib/stores/hydrate';
import { toast } from '@/lib/stores/ui';
import { downloadFile } from '@/lib/utils';
import { AiSettings } from './ai-settings';

function AppearanceCard() {
  return (
    <Card>
      <CardHeader title="Appearance" description="Also in the palette button at the top of every page." />
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
    </Card>
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
          <AppearanceCard />
          <NotificationsCard />
          <DataCard />
        </div>
        <AiSettings />
      </div>
    </>
  );
}
