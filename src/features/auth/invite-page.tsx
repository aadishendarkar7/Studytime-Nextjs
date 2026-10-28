'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, Logo } from '@/components/ui/icons';
import { api } from '@/lib/api';

/** Where invite links land: who invited you, and one button to join. */
export function InvitePage() {
  const id = String(useParams<{ id: string }>().id ?? '');
  const [who, setWho] = useState<{ name: string; school: string } | null>(null);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch(`/api/invite/${encodeURIComponent(id)}`).then(async (r) => (r.ok ? setWho(await r.json()) : setError('This invite link is not valid.')), () => setError('Could not load the invite.'));
    api.auth.me().then((r) => setSignedIn(Boolean(r.user)), () => undefined);
  }, [id]);
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5">
      <div className="w-full max-w-[420px] text-center">
        <div className="mb-8 flex items-center justify-center gap-2 text-[17px] font-semibold tracking-tight"><Logo className="size-7" /> Studytime</div>
        {error ? <p className="text-[15px] text-ink-2">{error}</p> : (
          <>
            <h1 className="font-sans text-[26px] leading-8 font-semibold tracking-tight">{who ? `${who.name} invited you to study together` : 'You are invited'}</h1>
            <p className="mt-2 text-[14px] text-muted">{who?.school ? `${who.name} studies at ${who.school}. ` : ''}See where friends are studying, drop your spot, and plan for exams with an AI tutor.</p>
            <ul className="mx-auto mt-6 grid max-w-[320px] gap-2 text-left text-[14px] text-ink-2">
              {['You follow each other right away', 'Free for students', 'Works on your phone and laptop'].map((t) => <li key={t} className="flex items-center gap-2"><Icon name="check" className="size-4 text-accent" />{t}</li>)}
            </ul>
            <Button size="lg" className="mt-8" onClick={() => (location.href = signedIn ? '/drop?tab=highlights' : `/signin?mode=signup&invite=${encodeURIComponent(id)}`)}>{signedIn ? 'Open Studytime' : 'Join Studytime'}</Button>
            {!signedIn && <p className="mt-3 text-[13px] text-muted">Already have an account? <a href="/signin" className="font-medium text-accent-ink hover:underline">Sign in</a></p>}
          </>
        )}
      </div>
    </div>
  );
}
