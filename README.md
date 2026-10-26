# Studytime

An AI study companion built with **Next.js 16** (App Router), **React 19**, **TypeScript**, and **Tailwind CSS v4**. It includes:

- **AI Tutor:** Snap & solve with cross-checking, a tutor chat with a "talk it through" mode, concept cards that track how well you know each concept, AI notes and cheatsheets, an assignment helper that produces a PDF study guide, and a writing assistant. You set your level, test prep, and one of 12 languages.
- **Study games:** spaced-repetition review, flashcards, quiz, matching, fill in the blank, and a speed round, plus folders, AI-generated cards, and a deck library (starter decks and decks shared by students).
- **Focus timer:** awards points and streaks, then asks for a short reflection after each session.
- **Planner:** deadlines with reminders, syllabus import (PDF, Word, or pasted text, with an AI option), calendar export, and an activity calendar.
- **Friends & classmates:** study circles you join with an invite link, plus live Class Study quizzes.
- **Leaderboards:** school, major, year, and class boards.
- **Rewards and Settings:** reward goals, your profile and goals, the AI provider, light/dark theme, accent color, and backup/restore.

## Run it on your computer

You need **Node.js 20.9 or newer** ([nodejs.org](https://nodejs.org), LTS version).

**Windows, easiest:** double-click **`Start Studytime.cmd`**. The first run installs and builds the app (a few minutes). Then it opens http://localhost:3000. Keep the black window open while you use the app.

**Any OS, from a terminal in this folder:**

```bash
npm install
npm run dev          # development mode with hot reload → http://localhost:3000
```

For a faster production version: `npm run build` then `npm start`.

> If you change the code after using `Start Studytime.cmd`, delete the `.next` folder so it rebuilds.

### Turn on the free AI

1. Get a free key at **https://aistudio.google.com/apikey**. You only need a Google account, no credit card. The key starts with `AIza` or `AQ.`.
2. In Studytime, open **Settings → AI tutor**, choose **Google Gemini (Free)**, paste the key, and click **Save key**.
3. Click **Test connection**.

The key is saved only in your browser. Other free options, Groq and OpenRouter, are in the same menu. They are text-only or have tighter daily limits. Free tiers cap how many requests you can make per minute and per day, and one Snap & solve uses about 3 requests.

**Optional:** to share one key with everyone who uses your copy of the app, copy `.env.example` to `.env.local` and set `GEMINI_API_KEY=...`. Set `AI_ACCESS_CODE` too, so only people you give the code to can use the shared key.

### Friends on the same Wi-Fi

`Start Studytime.cmd` makes the app reachable at `http://YOUR-COMPUTER-IP:3000` (find your IP with `ipconfig`). You may need to allow Node.js through Windows Firewall. To reach friends anywhere, host it online (see below).

## Host it on the internet (free)

### Option A: Vercel + Upstash (recommended, free tiers)

1. Put this folder in a **GitHub** repository. `.env.local` is ignored, so your keys stay private.
2. Go to **vercel.com**, sign in with GitHub, click **Add New → Project**, and import the repository. Vercel detects Next.js. Click **Deploy**.
3. Add a database so circles, classes, leaderboards, and shared decks work online:
   1. In your Vercel project, open **Storage** (or the Marketplace) and add **Upstash for Redis** on the free plan.
   2. Connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which Studytime reads automatically. You can also create the database at upstash.com and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` under **Settings → Environment Variables**.
4. **Optional:** to share an AI key, add these under **Settings → Environment Variables**:
   - `GEMINI_API_KEY`
   - `AI_ACCESS_CODE` (strongly recommended. Without it, anyone who finds your site can use up your free quota.)
5. Click **Redeploy**. Your site is live at `https://your-project.vercel.app`. You can connect your own domain under **Settings → Domains**.

**Hosting notes:**
- Vercel limits uploads to about 4.5 MB per request, so very large PDFs can fail on the hosted site. Upload fewer pages at a time.
- Each student's progress is stored in their own browser. To move it to another device, use **Settings → Backup & restore**.

### Option B: any Docker host (Render, Railway, Fly.io, a VPS)

```bash
docker build -t studytime .
docker run -p 3000:3000 -v studytime-data:/app/.data -e GEMINI_API_KEY=... -e AI_ACCESS_CODE=... studytime
```

Without Redis variables, data is saved to `/app/.data`, so keep that volume mounted. With several server instances, use Upstash Redis instead.

## Project structure

```
src/
  app/
    (app)/…              pages: /, /ai/*, /focus, /planner, /games, /friends, /leaderboards, /rewards, /settings
    api/…                route handlers: ai, circles, classes, leaderboard, decks
  components/
    ui/                  design system: Button, Card, Field, Dialog, Markdown (KaTeX), attachments, icons…
    shell/               app shell, navigation, global timer/reminder engine, print portal
  features/              one folder per feature: UI components + pure logic
    ai/ focus/ planner/ games/ social/ leaderboard/ rewards/ settings/ overview/
  lib/
    ai/                  provider catalog, streaming client, prompts, file handling
    stores/              Zustand stores persisted to localStorage (+ migration from the old HTML app)
    server/              storage drivers (file / Redis / memory), services, validation, rate limits
tests/
  unit/                  Vitest: focus points & streaks, spaced repetition, syllabus parser, server services
  e2e/smoke.mjs          Playwright end-to-end test against a fake AI provider
```

**Design choices:**

- **AI calls:** every AI request goes through `/api/ai`. The server talks to Gemini, Groq, OpenRouter, or Anthropic and streams back a single format. Adding a new provider means one adapter in `src/lib/server/ai.ts` plus one entry in `src/lib/ai/providers.ts`.
- **Storage:** all shared data goes through a small `Storage` interface. Use a JSON file locally and Redis in production; no feature code changes between them.
- **Validation and limits:** inputs are validated with Zod, and abuse-prone endpoints are rate limited.
- **Styling:** theme colors are CSS variables mapped into Tailwind (`bg-surface`, `text-ink`, `bg-accent-soft`, …), so light/dark mode and the accent color apply everywhere.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end test (after `npm run build`; needs `npm i -D playwright && npx playwright install chromium`) |

## Moving progress from the old HTML version

Browsers keep saved data separately for each web address. If the new app runs at the **same address** you used for the old version, it imports your old profile, sessions, study sets, and AI notes automatically on first load. If it doesn't (for example, the old version was the `Studytime App.html` file and the new one is `localhost:3000`), the new app starts fresh. From then on, use **Settings → Backup & restore** to move progress between devices.
