import type { Metadata } from 'next';
import { Contact, LegalPage, Operator, Section } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Studytime is run by <Operator />. This page explains what the app stores, where it is stored, and who can see it. Questions and requests go to <Contact />.
      </p>

      <Section title="Stored in your browser">
        <p>Most of your data never leaves your device. Studytime saves these in your browser&rsquo;s local storage:</p>
        <ul>
          <li>Your profile: name, school, major, year, courses, and your daily and weekly goals.</li>
          <li>Your focus sessions, points, streaks, deadlines, reminders, and check-ins.</li>
          <li>Your study sets and flashcard review history.</li>
          <li>AI tutor notes, chats, concept cards, and solved problems.</li>
          <li>Your AI provider settings, including any API key you paste in.</li>
          <li>Your grade calculator classes, GPA terms, saved study spots, focus sound choice, and color settings.</li>
        </ul>
        <p>Clearing your browser data removes all of it. Settings has a backup and restore option if you want to move it to another device. Studytime does not set cookies.</p>
      </Section>

      <Section title="Stored on our server">
        <p>The server stores data only when you use a shared feature:</p>
        <ul>
          <li><strong>Leaderboards.</strong> Your display name, school, major, year, and this week&rsquo;s focus minutes. Other students in the same school, major, or year can see your name and minutes. Leaderboard profiles do not expire automatically.</li>
          <li><strong>Study circles.</strong> Member names, focus minutes, and streaks. A circle is deleted 180 days after its last activity.</li>
          <li><strong>Class study rooms.</strong> Participant names, answers, and scores. A room is deleted 2 days after its last activity.</li>
          <li><strong>Study partner listings.</strong> The name, school, major, year, courses, availability, contact details, and note you enter. Anyone using Studytime can search and see a listing, including the contact details. A listing is deleted 30 days after you last update it, or right away when you remove it.</li>
          <li><strong>Shared study spots.</strong> The spot&rsquo;s name, map location, tags, note, and the school on your profile. Anyone using Studytime can see shared spots. They stay until you remove them from your spot list.</li>
          <li><strong>Shared decks.</strong> A deck&rsquo;s name, its cards, and the author name you chose. Shared decks do not expire automatically.</li>
        </ul>
        <p>To have a leaderboard profile or a shared deck removed, write to <Contact />.</p>
      </Section>

      <Section title="AI requests">
        <p>
          When you use the AI tutor, your message and anything you attach (text, photos, PDFs, Word files) is sent to our server and forwarded to the AI provider you picked: Google Gemini, Groq, OpenRouter, or Anthropic. The provider&rsquo;s own terms and privacy policy apply to what it receives. For example, Google may use prompts sent on the free Gemini tier to improve its products.
        </p>
        <p>If you paste your own API key, it is saved in your browser and sent with each request so the server can pass it to the provider. The server does not store it. If the site&rsquo;s operator has set a shared key, your requests use that key instead.</p>
        <p>Do not send anything through the AI tutor that you would not want a third-party AI provider to process.</p>
      </Section>

      <Section title="Your location">
        <p>The study spot map asks for your location only when you press &ldquo;Use my location&rdquo;. It is used to center the map and place a new spot, and it is not sent to our server unless you share that spot. Map images are loaded from OpenStreetMap, which receives your IP address and the area of the map you are viewing.</p>
      </Section>

      <Section title="IP addresses">
        <p>The server uses your IP address to limit how many AI requests, partner listings, and shared spots one visitor can make. The counters expire after one minute and one day. Our hosting provider may keep its own request logs.</p>
      </Section>

      <Section title="What we do not do">
        <ul>
          <li>No advertising and no ad trackers.</li>
          <li>No analytics scripts.</li>
          <li>No selling or sharing of your data for marketing.</li>
        </ul>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Delete your local data by clearing site data in your browser.</li>
          <li>Remove your partner listing or a shared spot at any time from its page.</li>
          <li>Leave a study circle at any time. Circles and class rooms then expire on the schedule above.</li>
          <li>Ask for server-side data to be removed by writing to <Contact />.</li>
        </ul>
      </Section>

      <Section title="Changes">
        <p>If this policy changes, the date at the top changes with it.</p>
      </Section>
    </LegalPage>
  );
}
