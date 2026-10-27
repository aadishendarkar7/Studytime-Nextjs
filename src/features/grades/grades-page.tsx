'use client';
import { useState } from 'react';
import { PageHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { GpaCalculator } from './gpa-calculator';
import { GradeCalculator } from './grade-calculator';

type Tab = 'grade' | 'gpa';

export function GradesPage() {
  const [tab, setTab] = useState<Tab>(() => (typeof location !== 'undefined' && location.hash === '#gpa' ? 'gpa' : 'grade'));
  return (
    <>
      <PageHeader
        title="Grades and GPA"
        description={tab === 'grade' ? 'Find the score you need on the rest of a class to finish with the grade you want.' : 'Work out your term and cumulative GPA, and what you need to reach a target.'}
        action={<Segmented label="Calculator" value={tab} onChange={(t) => (setTab(t), history.replaceState(null, '', t === 'gpa' ? '#gpa' : location.pathname))} options={[{ value: 'grade', label: 'Grade needed' }, { value: 'gpa', label: 'GPA' }]} />}
      />
      {tab === 'grade' ? <GradeCalculator /> : <GpaCalculator />}
    </>
  );
}
