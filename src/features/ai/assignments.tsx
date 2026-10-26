'use client';
import { useState } from 'react';
import { DropZone, FileTray, useAttachments } from '@/components/ui/attachments';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Note, Select, Textarea } from '@/components/ui/field';
import { toParts } from '@/lib/ai/files';
import { tutorSystem } from '@/lib/ai/prompts';
import { useAi, type Note as SavedNote } from '@/lib/stores/ai';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { NoteActions } from './notes';
import { AiOutput, Placeholder } from './ui';
import { useAiRun } from './use-ai-run';

export function AssignmentTool() {
  const ai = useAi();
  const courses = useProfile((s) => s.courses);
  const att = useAttachments(20);
  const run = useAiRun();
  const [course, setCourse] = useState('');
  const [depth, setDepth] = useState<'guided' | 'detailed'>('guided');
  const [focus, setFocus] = useState('');
  const [saved, setSaved] = useState<SavedNote | null>(null);
  const current = saved ? ai.notes.find((n) => n.id === saved.id) ?? null : null;

  const build = async () => {
    if (!att.files.length && !focus.trim()) return toast('Upload the assignment pages first.');
    setSaved(null);
    const text = await run.run({
      tier: 'main',
      maxTokens: 8000,
      system: tutorSystem(ai, 'You turn assignments into step-by-step study guides that teach the student how to complete the work themselves.'),
      messages: [{ role: 'user', content: [...toParts(att.files), { type: 'text', text: `Build a step-by-step study guide for this ${course ? `${course} ` : ''}assignment.\n\nStructure:\n# (assignment title)\n## Overview — what the assignment covers and an estimated time to complete\n## Concepts to review — each with a short explanation and formula/definition\n## Question-by-question guide — for every question or part: **What it's asking**, **Key idea**, **Steps** (numbered, so the student can follow along)${depth === 'detailed' ? ', **Worked solution**, and **Check your answer**' : ', and **Answer to check against** (brief)'}\n## Study checklist — a checkbox list (use "- [ ]") of what to do in order\n\n${focus.trim() ? `Student notes: ${focus.trim()}` : ''}` }] }],
    });
    if (!text) return;
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`]/g, '').trim() || `${course || 'Assignment'} study guide`;
    setSaved(ai.saveNote({ title, folder: 'Assignments', kind: 'guide', content: text }));
    toast('Study guide ready and saved to Notes › Assignments.');
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <CardHeader eyebrow="MULTI-PAGE UPLOAD" title="Assignment helper" description="Upload every page of an assignment at once. You’ll get a step-by-step study guide you can download as a PDF." />
        <Field label="Course" htmlFor="assignCourse"><Input id="assignCourse" list="assignCourses" maxLength={60} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. CHEM 110" /></Field>
        <datalist id="assignCourses">{courses.map((c) => <option key={c} value={c} />)}</datalist>
        <DropZone onFiles={att.add} accept="image/*,.pdf,.docx,.txt" title="Drop all assignment pages" hint="Photos or PDFs · up to 20 pages" inputId="assignFile" />
        <FileTray files={att.files} onRemove={att.remove} reading={att.reading} />
        <Field label="Guide detail" htmlFor="assignDepth">
          <Select id="assignDepth" value={depth} onChange={(e) => setDepth(e.target.value as 'guided' | 'detailed')}>
            <option value="guided">Guided — steps, with brief answers to check against</option>
            <option value="detailed">Detailed — full worked solutions</option>
          </Select>
        </Field>
        <Field label="Anything to focus on?" hint="optional" htmlFor="assignNotes"><Textarea id="assignNotes" rows={3} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. I’m stuck on part 3 and don’t understand limiting reagents" /></Field>
        <Button size="lg" block className="mt-5" loading={run.running} onClick={build}>Build my study guide</Button>
        <Note>Free providers have smaller upload limits. If a big PDF fails, upload fewer pages at a time.</Note>
      </Card>
      <Card>
        <CardHeader eyebrow="STUDY GUIDE" title="Step-by-step plan" />
        {current && run.status === 'done' && <NoteActions note={current} onDeleted={() => (setSaved(null), run.reset())} />}
        <div id="assignOutput">
          <AiOutput run={run} thinking={`Reading ${att.files.length || 'your'} page${att.files.length === 1 ? '' : 's'}…`} placeholder={<Placeholder title="Your study guide appears here.">An overview, the concepts to review, a question-by-question walkthrough, and a checklist.</Placeholder>} />
        </div>
      </Card>
    </div>
  );
}
