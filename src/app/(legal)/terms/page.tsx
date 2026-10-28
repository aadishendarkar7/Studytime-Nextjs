import type { Metadata } from 'next';
import Link from 'next/link';
import { Contact, LegalPage, Operator, Section } from '@/components/legal/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms and conditions' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and conditions">
      <p>
        These terms cover your use of Studytime, which is run by <Operator />. By using the app you agree to them. If you do not agree, do not use it.
      </p>

      <Section title="What Studytime is">
        <p>Studytime is a study tool: a focus timer, a deadline planner, flashcards with spaced repetition, an AI tutor, study circles, class quizzes, and leaderboards.</p>
      </Section>

      <Section title="AI output can be wrong">
        <p>The AI tutor can make mistakes, including wrong answers presented confidently. Check anything that matters against your course materials. Use solutions to learn the method, and follow your school&rsquo;s academic integrity rules. You are responsible for the work you submit.</p>
      </Section>

      <Section title="Your content">
        <p>You keep ownership of what you write, upload, and share. You give the operator permission to store and display shared content, such as your leaderboard name or a shared deck, as needed to run those features. Do not share content that is unlawful, harassing, or that you do not have the right to share.</p>
      </Section>

      <Section title="Acceptable use">
        <ul>
          <li>Do not try to break, overload, or bypass the limits of the service, including the AI request limits.</li>
          <li>Do not use the site&rsquo;s shared AI key if you were not given access to it.</li>
          <li>Do not impersonate another student or enter someone else&rsquo;s details on a leaderboard, partner listing, or shared spot.</li>
          <li>Do not use partner listings to send spam, harass anyone, or collect contact details for anything other than studying together.</li>
          <li>Drop and share only public places. Never drop a private home or anyone&rsquo;s address, and do not use drops to track or follow someone.</li>
        </ul>
      </Section>

      <Section title="Chat">
        <p>Be kind. Do not harass, threaten, spam, or share anyone&rsquo;s private information, including addresses and phone numbers, in chat. Messages in channels can be read by any student who opens them. Use Report on messages that break these rules and Block to hide someone. Messages that break these rules may be removed and the sender&rsquo;s access ended.</p>
      </Section>

      <Section title="Meeting study partners">
        <p>Studytime does not check who students are. You decide whether to contact or meet someone. Meet in a public place, tell someone where you are going, and leave if anything feels wrong. Studytime is not responsible for what happens between students who meet through it.</p>
      </Section>

      <Section title="Wellbeing features">
        <p>Check-ins, patterns and support suggestions are there to help you notice how you are doing. They are not medical advice, a diagnosis, or a substitute for a counselor or doctor. If you are in crisis, call or text 988 in the United States or call 911.</p>
      </Section>

      <Section title="Connected calendars">
        <p>Only connect calendars you have the right to use. Studytime reads them to show your schedule and plan study time, and is not responsible for mistakes in the calendars themselves, such as a due date your instructor changed.</p>
      </Section>

      <Section title="Points, levels and achievements">
        <p>Points, levels, achievements and leaderboard ranks are for tracking your own progress. They have no cash value, and the app does not issue gift cards, credits, or campus perks.</p>
      </Section>

      <Section title="Your data in the browser">
        <p>Your progress is stored in your browser, not in an account. If you clear your browser data without making a backup, it is gone and cannot be recovered. See the <Link href="/privacy" className="text-accent underline underline-offset-4">privacy policy</Link> for what is stored where.</p>
      </Section>

      <Section title="No warranty">
        <p>Studytime is provided as is and as available, without warranties of any kind. The service may change, be interrupted, or be discontinued. To the extent the law allows, the operator is not liable for indirect or consequential losses, or for any loss of data, grades, or study time arising from use of the app.</p>
      </Section>

      <Section title="Ending access">
        <p>You can stop using Studytime at any time. The operator can restrict access for anyone who breaks these terms.</p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the law of {LEGAL.governingLaw || '[governing law]'}.</p>
      </Section>

      <Section title="Changes and contact">
        <p>If these terms change, the date at the top changes with it. Questions go to <Contact />.</p>
      </Section>
    </LegalPage>
  );
}
