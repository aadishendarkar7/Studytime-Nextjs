'use client';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Note } from '@/components/ui/field';
import { useProfile } from '@/lib/stores/profile';

function Resource({ title, how, href, note }: { title: string; how: string; href?: string; note: string }) {
  return (
    <li className="rounded-xl border border-line p-4">
      <h3 className="text-[18px] leading-6">{title}</h3>
      <p className="mt-1 text-[16px] font-semibold text-accent-ink">{how}</p>
      <p className="mt-1 text-[14px] leading-[22px] text-ink-2">{note}</p>
      {href && <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[14px] font-medium text-accent-ink underline underline-offset-4">{href.replace(/^https:\/\//, '')}</a>}
    </li>
  );
}

export function HelpPage() {
  const school = useProfile((s) => s.school.trim());
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${school || 'my college'} counseling center`)}`;
  return (
    <>
      <PageHeader title="Support and resources" description="Studytime can help with habits, but it is not a counselor. If school stress is getting heavy, talking to a person helps." />
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <Card className="lg:col-span-7">
          <CardHeader title="If you need someone right now" description="Free and confidential in the United States, available 24 hours a day." />
          <ul className="grid gap-3">
            <Resource title="988 Suicide and Crisis Lifeline" how="Call or text 988" href="https://988lifeline.org" note="For any kind of emotional distress, not only suicidal thoughts. You can also chat online." />
            <Resource title="Crisis Text Line" how="Text HOME to 741741" href="https://www.crisistextline.org" note="A trained volunteer texts back, usually within minutes." />
            <Resource title="Emergency" how="Call 911" note="If you or someone else is in immediate danger." />
          </ul>
        </Card>
        <Card className="lg:col-span-5">
          <CardHeader title="On campus" />
          <p className="text-[15px] leading-6 text-ink-2">Most colleges offer free counseling to enrolled students, plus drop-in hours, workshops on stress and test anxiety, and academic coaching.</p>
          <a href={search} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[15px] font-semibold text-accent-ink underline underline-offset-4">Find {school ? `${school}’s` : 'your school’s'} counseling center</a>
          <h3 className="mt-6 text-[18px]">Small things that help</h3>
          <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[15px] leading-6 text-ink-2">
            <li>Sleep before an exam beats one more hour of cramming.</li>
            <li>Eat something and drink water before a long session.</li>
            <li>Tell a friend or a professor when you are falling behind. Extensions are more common than people think.</li>
            <li>Take the rest day. Rest is part of studying well.</li>
          </ul>
          <Note>Studytime does not share your check-ins with anyone. They stay in this browser.</Note>
        </Card>
      </div>
    </>
  );
}
