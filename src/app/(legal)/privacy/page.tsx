import type { Metadata } from 'next';
import { Contact, LegalPage, Operator, Section } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Studytime is an independent student project run by <Operator />. It is not affiliated with or endorsed by any university. This page explains what the app stores, where it is stored, and who can see it. Questions and requests go to <Contact />.
      </p>

      <Section title="The short version">
        <ul>
          <li>You can use Studytime without an account. Then your progress stays in your browser.</li>
          <li>With an account, a copy of your progress is saved so it follows you to other devices.</li>
          <li>Things you choose to share (posts, photos, drops, chat messages) are visible to the people you share them with.</li>
          <li>No ads, no ad trackers, no analytics scripts, and we never sell your data.</li>
          <li>You can delete your account and everything in it from Settings at any time.</li>
        </ul>
      </Section>

      <Section title="Who can use Studytime">
        <p>Studytime is meant for students aged 13 and older. It is not directed at children under 13, and we do not knowingly collect their information. If you believe a child under 13 has created an account, write to <Contact /> and we will delete it.</p>
      </Section>

      <Section title="Stored in your browser">
        <p>Studytime saves these in your browser&rsquo;s local storage, and keeps a copy in your account so they follow you to other devices (see &ldquo;Your account&rdquo;):</p>
        <ul>
          <li>Your profile: name, school, major, year, courses, and your daily and weekly goals.</li>
          <li>Your focus sessions, points, streaks, deadlines, reminders, and check-ins.</li>
          <li>Your study sets and flashcard review history.</li>
          <li>AI tutor notes, chats, concept cards, and solved problems.</li>
          <li>Your AI provider settings, including any API key you paste in.</li>
          <li>Lecture recordings, saved only in this browser&rsquo;s storage and never uploaded.</li>
          <li>Your tree, pet and mystery pack collection, and your study style quiz result.</li>
          <li>Courses the AI made for you and your lesson progress, challenges you joined, trophies, and the days you collected your check-in reward.</li>
          <li>Your saved study spots, drop history (places, times and who joined you), focus sound choice, and color settings.</li>
          <li>Your daily check-ins (mood, energy, stress, sleep and notes), rest days, water log, parked thoughts, and weekly resets. Check-ins and parked thoughts stay in this browser and are not copied to your account.</li>
          <li>Connected calendar links, the events downloaded from them, and your planned study blocks.</li>
        </ul>
        <p>Clearing your browser data removes all of it. If you have an account, your account copy is restored when you sign in again. Studytime sets one cookie, only to keep you signed in, and only after you sign in.</p>
      </Section>

      <Section title="Your account">
        <p>An account is optional. You need one to post to the Feed, follow people, see class pages, and keep your progress across devices. We store your email, name, and either your password (as a salted scrypt hash, never in plain text) or, if you use Google, your Google account ID. We also store your profile (school, major, year and classes) and a copy of your progress from the list above, without API keys, lecture recordings, check-ins or parked thoughts. Only you can read it. You can delete your account and everything in it from Settings › Account.</p>
        <p>If you ask for a password reset, we email you a single-use link that expires in an hour; only a scrambled copy of the link is stored. If you leave weekly recap emails on, we read your saved progress once a week to write a short summary and email it to you. Invite links contain your account ID; when someone joins from one, both accounts follow each other and we count how many people you invited.</p>
      </Section>

      <Section title="Stored on our server">
        <p>The server stores data only when you use a shared feature:</p>
        <ul>
          <li><strong>Reports and blocks.</strong> If you report a post, we store your account, the reason, and a copy of the post for review. Posts reported by several people are hidden. If you block someone, we store that so you stop seeing each other.</li>
          <li><strong>Feed posts.</strong> When you post a study session: your name, school, major, the time, how long you studied, what you studied, and anything optional you add (a photo, place, topics, the friends you studied with, and a caption). You choose who sees each post: friends only, friends and your school, or everyone. People who can see it can tap &ldquo;Nice work&rdquo;, which stores their name on it. If you tag friends (people you follow who follow you back), the post also shows on their feed and to their followers. Posts and their photos are deleted after 90 days, or right away when you delete them. We also store who you follow, and people can find your name, school and major when they search for classmates.</li>
          <li><strong>Photos.</strong> A photo you add to a post is shrunk in your browser before upload, which also removes hidden location data from the file. It is stored with the post and is only shown to people who can see that post. Do not post photos of other people without their permission.</li>
          <li><strong>Sharing a post.</strong> &ldquo;Share&rdquo; makes an image of the post in your browser, or a message with your invite link, and hands it to the app you pick (for example Instagram, WhatsApp or Messages). Once shared, that app&rsquo;s own terms apply.</li>
          <li><strong>You vs friends.</strong> Friends who follow you back can see your total focus time for the last 7 days, worked out from your saved progress. People who do not follow you back cannot.</li>
          <li><strong>Chat.</strong> A random chat ID kept in your browser, plus your display name, school, major, year, courses, and a short status (focusing, the place of a drop you are part of, or online), updated every 30 seconds while the app is open. Everyone using Studytime can see this while you show as online; turn off &ldquo;Show me as online&rdquo; to hide it. Messages you send are stored with your name: channel messages can be read by anyone who opens that channel, and direct messages only by the two of you. Each channel keeps its latest 300 messages. You can delete your own messages, and reported messages are kept for review.</li>
          <li><strong>Focus Buddy.</strong> While you opt in and a session runs: your display name, your subject or course, your school (only used to find a match, never shown), and when your session started and ends. Your buddy sees your name, task and timer. Nothing else is shared, there is no camera or chat, and the record is deleted 30 minutes after the session ends.</li>
          <li><strong>Weekly pacts.</strong> Your display name, the weekly goal, and your focus minutes this week. Your pact partner can see them. Leaving a pact removes you from it.</li>
          <li><strong>Study events.</strong> Everything you enter when you post an event, plus your display name as host, and the names of people who RSVP. Events are visible to students at your school or to everyone, as you choose, and are deleted a day after they end.</li>
          <li><strong>Chat profile extras.</strong> Your profile prompts and study style, if you add them, are shown to people who open your chat profile.</li>
          <li><strong>Leaderboards.</strong> Your display name, school, major, year, this week&rsquo;s focus minutes, and how many drops you hosted or joined this week. Other students in the same school, major, or year can see your name and minutes. Leaderboard profiles do not expire automatically.</li>
          <li><strong>Study circles.</strong> Member names, focus minutes, and streaks. A circle is deleted 180 days after its last activity.</li>
          <li><strong>Class study rooms.</strong> Participant names, answers, and scores. A room is deleted 2 days after its last activity.</li>
          <li><strong>Study partner listings.</strong> The name, school, major, year, courses, availability, contact details, and note you enter. Anyone using Studytime can search and see a listing, including the contact details. A listing is deleted 30 days after you last update it, or right away when you remove it.</li>
          <li><strong>Shared study spots.</strong> The spot&rsquo;s name, map location, tags, note, and the school on your profile. Anyone using Studytime can see shared spots. They stay until you remove them from your spot list.</li>
          <li><strong>Drop a Spot.</strong> When you drop a spot: your display name, the place name, its map location if you added one, what you are studying, your note, the start and end time, who can see it (your friend circle, your school, or everyone), and your school. People who tap &ldquo;I&rsquo;m coming&rdquo; add their display name to it. If you are signed in, the drop also stores your account ID, never shown to anyone, so people who follow you can get a &ldquo;study with them?&rdquo; alert. A drop is deleted an hour after it ends, or as soon as you end it. &ldquo;Just me&rdquo; drops are never sent to the server.</li>
          <li><strong>Study rooms.</strong> Your display name, whether you are focusing, on a break or idle, the subject while your timer runs, this week&rsquo;s focus minutes and weekly goal, and kudos sent in the room. Other people in the room can see this. A room is deleted 7 days after its last visit, and leaving a room removes you from it.</li>
          <li><strong>Calendar subscribe link.</strong> If you create one, the titles and times of your study blocks and the titles and due times of your planner deadlines, so your calendar app can download them. Anyone with the link can see it. It is deleted when you turn the link off, or 180 days after its last update.</li>
          <li><strong>Shared decks.</strong> A deck&rsquo;s name, its cards, and the author name you chose. Shared decks do not expire automatically.</li>
        </ul>
        <p>To have a leaderboard profile or a shared deck removed, write to <Contact />.</p>
      </Section>

      <Section title="AI requests">
        <p>
          When you use the AI tutor, AI courses, or the Ask, Summarize, Flashcards and Quiz buttons on your notes, your message and anything you attach (text, photos, PDFs, Word files, or the note itself) is sent to our server and forwarded to an AI provider: Google Gemini by default, or Groq, OpenRouter or Anthropic. The provider&rsquo;s own terms and privacy policy apply to what it receives. For example, Google may use prompts sent on the free Gemini tier to improve its products.
        </p>
        <p>If you paste your own API key, it is saved in your browser and sent with each request so the server can pass it to the provider. The server does not store it. If the site&rsquo;s operator has set a shared key, your requests use that key instead.</p>
        <p>The same applies to &ldquo;Break it down&rdquo; in the planner: the assignment title, due date and any details you paste are sent to the AI provider.</p>
        <p>When you press &ldquo;Make notes&rdquo; on a lecture recording, the audio is converted to a small, lower-quality copy in your browser and sent in pieces to Google Gemini to be written out as text. The recording itself stays in your browser.</p>
        <p>Do not send anything through the AI tutor that you would not want a third-party AI provider to process.</p>
      </Section>

      <Section title="Connected calendars">
        <p>When you connect a Google, Canvas, Outlook or iCloud calendar, the link you paste is saved in your browser. To read it, your browser sends the link to our server, which downloads the calendar from that service and sends the events back. The server does not store the link or the events.</p>
      </Section>

      <Section title="Your location">
        <p>Studytime asks for your location only when you press &ldquo;Use my location&rdquo;. It is used to place your drop or spot on the map, and it is sent to our server only as part of a drop or a shared spot. Map images are loaded from OpenStreetMap, which receives your IP address and the area of the map you are viewing.</p>
      </Section>

      <Section title="IP addresses">
        <p>The server uses your IP address to limit how many AI requests, posts, calendar downloads, drops, partner listings, shared spots, and room actions one visitor can make. Visitors without an account get a smaller daily AI allowance. The counters expire after one minute and one day. Our hosting provider may keep its own request logs.</p>
      </Section>

      <Section title="Services we use">
        <ul>
          <li><strong>Vercel</strong> hosts the website and runs the server (United States).</li>
          <li><strong>Redis Cloud</strong>, through Vercel, stores accounts, posts and the other server data listed above.</li>
          <li><strong>Google Gemini</strong> (and Groq, OpenRouter or Anthropic if configured) answers AI requests.</li>
          <li><strong>Resend</strong> sends password reset and weekly recap emails, if turned on.</li>
          <li><strong>OpenStreetMap</strong> provides map images.</li>
          <li><strong>Google Sign-In</strong>, only if you choose to sign in with Google.</li>
        </ul>
        <p>Each only receives what it needs to do its job, under its own privacy policy.</p>
      </Section>

      <Section title="Keeping data safe">
        <p>Passwords are stored as salted scrypt hashes, sign-in cookies are signed and expire after 60 days, changing your password signs out every other device, and API keys are never sent to the browser. No system is perfectly secure, so please use a password you do not use anywhere else.</p>
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
          <li>Delete your account and everything stored with it from Settings &rsaquo; Account.</li>
          <li>Delete any post or photo from the Feed at any time.</li>
          <li>Delete your local data by clearing site data in your browser.</li>
          <li>Remove your partner listing or a shared spot at any time from its page.</li>
          <li>Leave a study room or turn off your calendar subscribe link at any time.</li>
          <li>Leave a study circle at any time. Circles and class rooms then expire on the schedule above.</li>
          <li>Ask for a copy of your data, a correction, or removal of server-side data by writing to <Contact />. We reply within 30 days.</li>
        </ul>
      </Section>

      <Section title="Changes">
        <p>If this policy changes, the date at the top changes with it.</p>
      </Section>
    </LegalPage>
  );
}
