'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras, type GoogleDocLink } from '@/lib/stores/extras';
import { toast } from '@/lib/stores/ui';
import { cn, shortDate } from '@/lib/utils';

const KIND_LABEL: Record<GoogleDocLink['kind'], string> = { document: 'Doc', spreadsheets: 'Sheet', presentation: 'Slides' };
const KIND_COLOR: Record<GoogleDocLink['kind'], string> = { document: '#4285f4', spreadsheets: '#0f9d58', presentation: '#f4b400' };

/** Reads a Google Docs, Sheets or Slides link. Returns null for anything else. */
export function parseGoogleDoc(url: string): { kind: GoogleDocLink['kind']; id: string } | null {
  const m = /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/.exec(url.trim());
  return m ? { kind: m[1] as GoogleDocLink['kind'], id: m[2] } : null;
}

const base = (d: Pick<GoogleDocLink, 'kind' | 'id'>) => `https://docs.google.com/${d.kind}/d/${d.id}`;
/** The preview page can be shown inside other sites; the editor opens in its own tab. */
export const previewUrl = (d: Pick<GoogleDocLink, 'kind' | 'id'>) => `${base(d)}/preview`;
export const editUrl = (d: Pick<GoogleDocLink, 'kind' | 'id'>) => `${base(d)}/edit`;

function DocViewer({ doc, onBack }: { doc: GoogleDocLink; onBack: () => void }) {
  const x = useExtras();
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> All docs</button>
        <h2 className="mr-auto min-w-0 truncate text-[20px] leading-7">{doc.title}</h2>
        <Button size="sm" variant="ghost" onClick={() => {
          const t = prompt('Rename', doc.title)?.trim();
          if (t) x.update({ googleDocs: x.googleDocs.map((d) => (d.id === doc.id ? { ...d, title: t.slice(0, 80) } : d)) });
        }}><Icon name="pen" className="size-4" /> Rename</Button>
        <a href={editUrl(doc)} target="_blank" rel="noopener noreferrer"><Button size="sm"><Icon name="pen" className="size-4" /> Edit in Google {KIND_LABEL[doc.kind] === 'Doc' ? 'Docs' : KIND_LABEL[doc.kind] === 'Sheet' ? 'Sheets' : 'Slides'}</Button></a>
      </div>
      <iframe
        key={doc.id}
        title={doc.title}
        src={previewUrl(doc)}
        className="h-[calc(100dvh-220px)] min-h-[520px] w-full rounded-xl border border-line bg-white"
        allow="clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="text-[12px] text-muted">Seeing “You need access”? Sign in to Google in this browser, or set the doc’s sharing to “Anyone with the link”. Edits you make in Google show here when you reopen it.</p>
    </div>
  );
}

/** Google Docs, Sheets and Slides for your classes, opened right inside Study. */
export function GoogleDocsTool() {
  const x = useExtras();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = x.googleDocs.find((d) => d.id === openId);

  const add = () => {
    const parsed = parseGoogleDoc(url);
    if (!parsed) return toast('Paste a link to a Google Doc, Sheet or Slides file.', 'error');
    if (x.googleDocs.some((d) => d.id === parsed.id)) {
      setOpenId(parsed.id);
      return toast('Already added. Opening it.');
    }
    const doc: GoogleDocLink = { ...parsed, title: title.trim().slice(0, 80) || `Untitled ${KIND_LABEL[parsed.kind]}`, folder: 'General', addedAt: Date.now() };
    x.update({ googleDocs: [doc, ...x.googleDocs] });
    setUrl('');
    setTitle('');
    setOpenId(doc.id);
  };

  if (open) return <DocViewer doc={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-[17px] leading-6 font-semibold">Google Docs in Studytime</h2>
        <p className="mt-0.5 text-[14px] text-muted">Keep the docs, sheets and slides for your classes next to your notes and tutor. In Google, click Share, copy the link and paste it here.</p>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
          <Input className="min-w-60 flex-[2]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" aria-label="Google Docs link" />
          <Input className="min-w-40 flex-1" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (optional)" aria-label="Name" />
          <Button type="submit" disabled={!url.trim()}><Icon name="plus" className="size-4" /> Add</Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
          <a className="text-accent-ink hover:underline" href="https://docs.google.com/document/create" target="_blank" rel="noopener noreferrer">+ New Google Doc</a>
          <a className="text-accent-ink hover:underline" href="https://docs.google.com/spreadsheets/create" target="_blank" rel="noopener noreferrer">+ New Sheet</a>
          <a className="text-accent-ink hover:underline" href="https://docs.google.com/presentation/create" target="_blank" rel="noopener noreferrer">+ New Slides</a>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Your docs</h2>
        {x.googleDocs.length ? (
          <ul className="divide-y divide-line">
            {x.googleDocs.map((d) => (
              <li key={d.id} className="flex items-center gap-1">
                <button type="button" onClick={() => setOpenId(d.id)} className="group flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: KIND_COLOR[d.kind] }}>{KIND_LABEL[d.kind][0]}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[15px] font-medium group-hover:underline">{d.title}</strong><small className="text-[13px] text-muted">Google {KIND_LABEL[d.kind]} · added {shortDate(d.addedAt)}</small></span>
                </button>
                <a href={editUrl(d)} target="_blank" rel="noopener noreferrer" aria-label={`Edit ${d.title} in Google`} title="Edit in Google" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="pen" className="size-4" /></a>
                <button type="button" aria-label={`Remove ${d.title}`} title="Remove from Studytime" onClick={() => confirm(`Remove “${d.title}” from Studytime? The file stays in your Google Drive.`) && x.update({ googleDocs: x.googleDocs.filter((y) => y.id !== d.id) })} className={cn('grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger')}><Icon name="trash" className="size-4" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="py-6 text-center text-[14px] text-muted">No docs yet</p>}
      </section>
    </div>
  );
}

