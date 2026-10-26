'use client';
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Note, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { profileLine, WRITE_PROMPTS } from '@/lib/ai/prompts';
import { useAi } from '@/lib/stores/ai';
import { toast } from '@/lib/stores/ui';
import { copyText } from '@/lib/utils';
import { AiOutput, Placeholder } from './ui';
import { useAiRun } from './use-ai-run';

type WriteMode = keyof typeof WRITE_PROMPTS;
const countWords = (t: string) => (t.trim().match(/\S+/g) || []).length;

export function WritingTool() {
  const ai = useAi();
  const run = useAiRun();
  const [prompt, setPrompt] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<WriteMode>('feedback');
  const go = () => {
    if (!text.trim() && !(prompt.trim() && (mode === 'outline' || mode === 'thesis'))) return toast('Paste your writing first.');
    run.run({
      tier: 'main',
      maxTokens: 6000,
      system: `You are a supportive, expert writing tutor. ${profileLine(ai)} Respect the student's ideas and voice. Use Markdown.`,
      messages: [{ role: 'user', content: `${WRITE_PROMPTS[mode]}\n\n${prompt.trim() ? `Assignment prompt: ${prompt.trim()}\n\n` : ''}${text.trim() ? `Student writing (${countWords(text)} words):\n"""\n${text.slice(0, 60_000)}\n"""` : ''}` }],
    });
  };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <CardHeader eyebrow="ESSAYS & PAPERS" title="Writing assistant" />
        <Field label="Assignment prompt" hint="optional" htmlFor="writePrompt"><Input id="writePrompt" maxLength={600} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Analyze the causes of the French Revolution" /></Field>
        <Field label="Your writing" htmlFor="writeText"><Textarea id="writeText" rows={13} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your essay, paragraph, or notes" /></Field>
        <Note className="mt-1" >{countWords(text)} words</Note>
        <Field label="What do you need?">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'feedback', label: 'Feedback & score' }, { value: 'clarity', label: 'Improve clarity' }, { value: 'grammar', label: 'Fix grammar' }, { value: 'concise', label: 'Make concise' }, { value: 'thesis', label: 'Thesis help' }, { value: 'outline', label: 'Build outline' }]} />
        </Field>
        <Button size="lg" block className="mt-5" loading={run.running} onClick={go}>Review my writing</Button>
      </Card>
      <Card>
        <CardHeader eyebrow="RESULT" title="Suggestions" action={run.status === 'done' && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={async () => toast((await copyText(run.text)) ? 'Copied.' : 'Could not copy.')}>Copy</Button>
            <Button size="sm" variant="secondary" onClick={() => (ai.saveNote({ title: `Writing ${mode} · ${new Date().toLocaleDateString()}`, folder: 'General', kind: 'writing', content: run.text }), toast('Saved to Notes.'))}>Save to notes</Button>
          </div>
        )} />
        <div id="writeOutput">
          <AiOutput run={run} thinking="Reading your writing…" placeholder={<Placeholder title="Feedback appears here.">Scores for thesis, structure, evidence, clarity, and grammar, with specific rewrites.</Placeholder>} />
        </div>
      </Card>
    </div>
  );
}
