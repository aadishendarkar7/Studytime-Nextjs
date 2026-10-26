'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Empty } from '@/components/ui/card';
import { DropZone } from '@/components/ui/attachments';
import { Field, Input, Note, Select, Textarea } from '@/components/ui/field';
import { callJSON, resolveConnection } from '@/lib/ai/client';
import { extractDocxText } from '@/lib/ai/files';
import { SYLLABUS_SYSTEM } from '@/lib/ai/prompts';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { ReminderType } from '@/lib/types';
import { localDateTimeValue } from '@/lib/utils';
import { REMINDER_TYPES } from '@/features/shared';
import { pdfToText } from './pdf';
import { guessType, scanSyllabus, type ImportCandidate } from './syllabus';

const toBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export function SyllabusImport() {
  const { addReminder, courses } = useProfile();
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('Your file is read in this browser. Check every date before saving.');
  const [items, setItems] = useState<ImportCandidate[]>([]);
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const scan = (text: string) => {
    const found = scanSyllabus(text);
    setItems(found);
    setStatus(found.length ? `Found ${found.length} possible deadlines. Review dates and titles before adding them.` : 'No dated assignments found. Try “Find with AI”, or paste the schedule below.');
    return found;
  };

  const read = async (f: File) => {
    setFile(f);
    setStatus(`Reading ${f.name}…`);
    const ext = f.name.split('.').pop()?.toLowerCase();
    try {
      const text = ext === 'pdf' ? await pdfToText(f) : ext === 'docx' ? await extractDocxText(f) : ['txt', 'csv', 'md'].includes(ext || '') ? await f.text() : null;
      if (text === null) throw new Error('Choose a PDF, Word (.docx), or text file.');
      if (!scan(text).length) setPasted(text.slice(0, 30_000));
    } catch (error) {
      setStatus(`Could not read this file: ${(error as Error).message}. Try “Find with AI” or paste the schedule text below.`);
    }
  };

  const findWithAi = async () => {
    if (resolveConnection().mode === 'none') return toast('Connect the AI tutor in Settings first (it’s free with Gemini).', 'error');
    if (!file && !pasted.trim()) return toast('Upload a syllabus or paste its text first.');
    setAiBusy(true);
    setStatus('The AI is reading your syllabus…');
    try {
      const parts =
        file && file.name.toLowerCase().endsWith('.pdf')
          ? [{ type: 'pdf' as const, data: await toBase64(file), name: file.name }]
          : [{ type: 'text' as const, text: (file && file.name.toLowerCase().endsWith('.docx') ? await extractDocxText(file) : file ? await file.text() : pasted).slice(0, 120_000) }];
      const result = await callJSON<{ items?: { title: string; type: string; due: string }[] }>({
        tier: 'main',
        maxTokens: 3000,
        system: `${SYLLABUS_SYSTEM} Today is ${new Date().toISOString().slice(0, 10)}.`,
        messages: [{ role: 'user', content: [...parts, { type: 'text', text: 'List every graded deadline in this syllabus.' }] }],
      });
      const found: ImportCandidate[] = (result.items ?? [])
        .map((x) => {
          const [y, m, d] = String(x.due).split('-').map(Number);
          const date = new Date(y, m - 1, d, 23, 59);
          const type = (['homework', 'exam', 'assignment'].includes(x.type) ? x.type : guessType(x.title)) as ReminderType;
          return { title: String(x.title).slice(0, 80), type, dueAt: date.getTime(), selected: date.getTime() > Date.now() };
        })
        .filter((x) => x.title && Number.isFinite(x.dueAt));
      setItems(found);
      setStatus(found.length ? `The AI found ${found.length} deadlines. Check each date against your syllabus.` : 'The AI did not find dated deadlines in this file.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const patch = (i: number, p: Partial<ImportCandidate>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const importSelected = () => {
    let added = 0;
    for (const c of items) {
      if (!c.selected || !c.title.trim() || !Number.isFinite(c.dueAt) || c.dueAt <= Date.now()) continue;
      if (addReminder({ title: course.trim() ? `${course.trim()}: ${c.title.trim()}` : c.title.trim(), type: c.type, dueAt: c.dueAt, lead: 1440, source: 'syllabus' })) added++;
    }
    toast(`${added} deadline${added === 1 ? '' : 's'} added to Planner.`);
    if (added) setItems([]);
  };

  return (
    <section id="syllabus" className="grid scroll-mt-6 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader eyebrow="FROM SYLLABUS TO PLAN" title="Import a syllabus" description="Drop a PDF or Word file, then review each deadline before adding it." />
        <Field label="Course name" htmlFor="syllabusCourse"><Input id="syllabusCourse" list="courseList" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. BIO 101" /></Field>
        <datalist id="courseList">{courses.map((c) => <option key={c} value={c} />)}</datalist>
        <DropZone onFiles={(f) => read(f[0])} accept=".pdf,.docx,.txt,.csv,.md" multiple={false} title="Drop your syllabus here" hint="or click to choose a PDF, Word, or text file" inputId="syllabusFile" />
        <Note className="mt-0">{status}</Note>
        <Button variant="secondary" className="mt-3" loading={aiBusy} onClick={findWithAi}>✦ Find with AI</Button>
        <details className="mt-5 text-sm">
          <summary className="font-bold text-ink-2">Having trouble? Paste the schedule</summary>
          <Textarea className="mt-3" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Week 3 — Essay due October 30, 2026" />
          <Button variant="secondary" className="mt-2" onClick={() => (setFile(null), scan(pasted))}>Scan pasted text</Button>
        </details>
      </Card>
      <Card>
        <CardHeader eyebrow="REVIEW FIRST" title="Deadlines found" description="Edit titles and dates. Only checked items will be added." />
        {items.length ? (
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {items.map((c, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" className="mt-3 size-4 accent-[var(--accent)]" checked={c.selected} onChange={(e) => patch(i, { selected: e.target.checked })} aria-label={`Include deadline ${i + 1}`} />
                <div className="grid flex-1 gap-2">
                  <Input value={c.title} onChange={(e) => patch(i, { title: e.target.value })} aria-label="Assignment title" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={c.type} onChange={(e) => patch(i, { type: e.target.value as ReminderType })} aria-label="Type">
                      {Object.entries(REMINDER_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                    <Input type="datetime-local" value={localDateTimeValue(c.dueAt)} onChange={(e) => patch(i, { dueAt: new Date(e.target.value).getTime() })} aria-label="Due date" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Upload a syllabus to preview its deadlines.</Empty>
        )}
        <Button className="mt-4" disabled={!items.some((x) => x.selected)} onClick={importSelected}>Add selected to Planner</Button>
      </Card>
    </section>
  );
}
