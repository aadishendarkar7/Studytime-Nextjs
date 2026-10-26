'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendBrowserAlert } from '@/components/shell/global-effects';
import { toast } from '@/lib/stores/ui';

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const status =
    permission === 'unsupported' ? 'Browser alerts are unavailable here. In-app reminders still work while Studytime is open.'
    : permission === 'granted' ? 'Browser alerts are on while Studytime is open.'
    : permission === 'denied' ? 'Browser alerts are blocked in your browser settings.'
    : 'Browser alerts are off. Turn them on to get desktop reminders while Studytime is open.';
  return (
    <details className="mt-5 rounded-2xl border border-line bg-surface px-6 py-4 shadow-card">
      <summary className="text-sm font-bold">Notification settings</summary>
      <p className="mt-3 text-sm text-muted">{status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={permission !== 'default'} onClick={async () => setPermission(await Notification.requestPermission())}>
          {permission === 'granted' ? 'Browser alerts enabled' : 'Enable browser alerts'}
        </Button>
        <Button variant="ghost" onClick={() => (toast('Test reminder: Studytime is ready.'), sendBrowserAlert('Studytime test', 'Your study reminders are ready.'))}>Send a test alert</Button>
      </div>
    </details>
  );
}
