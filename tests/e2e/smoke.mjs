// End-to-end smoke test: builds nothing, expects `npm run build` first.
// Starts the production server twice against a local fake AI provider, then drives
// the app in Chromium. Run: npm run build && npm run test:e2e
// Requires: npm i -D playwright && npx playwright install chromium
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = process.cwd();
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const USER_KEY = 'AQ.test-user-key-abcdefghijklmnopqrstuvwxyz';
const SERVER_KEY = 'AIzaServerKey-abcdefghijklmnopqrstuvwxyz';
let failures = 0;
const errors = [];
const check = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`);
  if (!cond) failures++;
};

// ---------- Fake Gemini + Groq ----------
const calls = [];
function reply(system, user) {
  if (system.includes('independent answer checker')) return JSON.stringify({ agree: true, final_answer: '2x sin x + x^2 cos x', note: 'Product rule applied correctly.' });
  if (system.includes('core academic concepts')) return '```json\n' + JSON.stringify({ concepts: [{ name: 'Product rule', subject: 'Calculus', summary: 'Derivative of a product is f′g + fg′.', example: 'd/dx[x sin x]' }, { name: 'Derivative of sine', subject: 'Calculus', summary: 'd/dx sin x = cos x.' }] }) + '\n```';
  if (system.includes('study flashcards')) return JSON.stringify({ cards: Array.from({ length: 6 }, (_, i) => ({ front: `Question ${i + 1}?`, back: `Answer ${i + 1}` })) });
  if (system.includes('multiple-choice questions')) return JSON.stringify({ questions: [{ q: 'Q1?', options: ['a', 'b', 'c', 'd'], answer: 1, why: 'Because b.' }, { q: 'Q2?', options: ['w', 'x', 'y', 'z'], answer: 0, why: 'w.' }] });
  if (system.includes('Return only JSON {"name"')) return JSON.stringify({ name: 'Photosynthesis', subject: 'Biology', summary: 'Plants turn light into chemical energy.', example: '6CO2 + 6H2O → C6H12O6 + 6O2' });
  if (system.includes('extract graded deadlines')) return JSON.stringify({ items: [{ title: 'Lab report 2', type: 'assignment', due: '2099-03-04' }] });
  if (user.includes('Reply with exactly the word: ready')) return 'ready';
  if (user.includes('practice problems')) return '## Practice problems\n1. Differentiate $x^3 \\cos x$.\n\n## Answers\n1. $3x^2\\cos x - x^3 \\sin x$';
  if (user.includes('study guide')) return '# Lab 3 Study Guide\n\n## Overview\nCovers stoichiometry.\n\n## Study checklist\n- [ ] Review moles\n- [x] Read the lab';
  return '## Problem\nFind $\\frac{d}{dx}[x^2 \\sin x]$.\n\n## Steps\n1. Use the **product rule**: $(fg)\' = f\'g + fg\'$.\n2. So $$2x\\sin x + x^2\\cos x$$\n\n| Part | Value |\n|---|---|\n| f | $x^2$ |\n\n## Answer\n**$2x\\sin x + x^2\\cos x$** costs $5 and $10.';
}
const chunks = (t) => t.match(/[\s\S]{1,14}/g) || [''];
const stub = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    if (req.url.includes(':streamGenerateContent')) {
      const key = req.headers['x-goog-api-key'];
      if (key !== USER_KEY && key !== SERVER_KEY) return res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: 'API key not valid' } }));
      const model = decodeURIComponent(req.url.split('/models/')[1].split(':')[0]);
      const system = body.systemInstruction?.parts?.[0]?.text || '';
      const last = body.contents.at(-1);
      const user = last.parts.filter((p) => p.text).map((p) => p.text).join('\n');
      calls.push({ provider: 'gemini', model, key, system, contents: body.contents });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }] } }] })}\n\n`);
      for (const c of chunks(reply(system, user))) res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: c }], role: 'model' } }] })}\n\n`);
      return res.end();
    }
    if (req.url.endsWith('/chat/completions')) {
      const system = body.messages.find((m) => m.role === 'system')?.content || '';
      const last = body.messages.at(-1);
      calls.push({ provider: 'groq', model: body.model, system });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const c of chunks(reply(system, typeof last.content === 'string' ? last.content : ''))) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    res.writeHead(404).end();
  });
});
await new Promise((r) => stub.listen(4999, r));

function startServer(port, env) {
  const child = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    cwd: ROOT,
    env: { ...process.env, STORAGE_DRIVER: 'memory', GEMINI_BASE_URL: 'http://127.0.0.1:4999', GROQ_BASE_URL: 'http://127.0.0.1:4999', ...env },
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server ${port}] ${d}`));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 30_000);
    child.stdout.on('data', (d) => {
      if (/Ready|started/i.test(String(d))) {
        clearTimeout(timer);
        resolve(child);
      }
    });
  });
}

const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text()) && errors.push(`${label} console: ${m.text()}`));
};
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const toastText = (page) => page.locator('[role=status] button').last().textContent({ timeout: 4000 }).catch(() => '');

const browser = await chromium.launch();
const server1 = await startServer(3100, {});
try {
  const BASE = 'http://127.0.0.1:3100';
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    window.print = () => (window.__printed = (window.__printed || 0) + 1);
  });
  const page = await ctx.newPage();
  watch(page, 'phase1');
  await page.goto(BASE);
  await page.waitForSelector('text=Good');
  await page.screenshot({ path: `${SHOTS}/01-home.png` });
  for (const [href, text] of [['/ai', 'AI Tutor'], ['/focus', 'Focus timer'], ['/planner', 'Study planner'], ['/games', 'Study games'], ['/friends', 'Friends & classmates'], ['/leaderboards', 'Leaderboards'], ['/rewards', 'Rewards'], ['/settings', 'Settings']]) {
    await page.click(`aside a[href="${href}"]`);
    await page.waitForURL(`**${href}`);
    check(await page.locator('h1', { hasText: text }).waitFor({ timeout: 5000 }).then(() => true, () => false), `navigate to ${href}`);
  }

  // AI not connected yet
  await page.click('aside a[href="/ai"]');
  await page.waitForSelector('text=AI not connected');
  check(await page.getByText('AI not connected').first().isVisible(), 'AI shows not connected without a key');
  await page.fill('#solveText', 'derivative of x^2 sin x');
  await page.click('button:has-text("Solve it")');
  check(await page.getByText('Add a free AI key').isVisible(), 'Solve without key explains setup');
  await page.click('text=Open AI settings');
  await page.waitForURL('**/settings#ai');

  // Settings: save the Gemini key (new AQ. format)
  check(await page.locator('[role=radio][aria-checked=true]', { hasText: 'Google Gemini' }).count() === 1, 'Gemini is the default provider');
  await page.fill('#aiKeyInput', USER_KEY);
  await page.click('button:has-text("Save key")');
  check((await toastText(page)).includes('key saved'), 'AQ.-format key accepted');
  check(await page.getByText('Google Gemini · your key').first().isVisible(), 'Connection pill shows own key');
  await page.click('button:has-text("Test connection")');
  await page.waitForTimeout(500);
  check((await toastText(page)).includes('ready'), 'Test connection succeeds');
  await page.screenshot({ path: `${SHOTS}/02-settings.png`, fullPage: true });

  // Snap & solve
  await page.click('aside a[href="/ai"]');
  await page.setInputFiles('#solveFile', { name: 'hw.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.waitForSelector('img[alt=""]');
  await page.fill('#solveText', 'derivative of x^2 sin x');
  await page.click('button:has-text("Solve it")');
  await page.waitForSelector('text=Cross-check agrees', { timeout: 10_000 });
  await page.waitForSelector('a:has-text("Product rule")', { timeout: 5000 });
  const solveHtml = await page.innerHTML('#solveOutput');
  check(solveHtml.includes('<h2>Steps</h2>') && solveHtml.includes('<ol>') && solveHtml.includes('<table>'), 'Markdown rendered');
  check((await page.locator('#solveOutput .katex').count()) >= 4, 'KaTeX math rendered');
  check((await page.textContent('#solveOutput')).includes('costs $5 and $10'), 'Currency not treated as math');
  const mainCall = calls.find((c) => c.contents?.[0]?.parts?.some((p) => p.inline_data?.mime_type === 'image/jpeg'));
  check(mainCall?.model === 'gemini-3.8-flash' && mainCall.key === USER_KEY, 'Photo sent to Gemini with the user key');
  check(calls.some((c) => c.system.includes('core academic concepts') && c.model === 'gemini-3.5-flash-lite'), 'Concept extraction uses the fast model');
  check(!(await page.textContent('#solveOutput')).includes('thinking…'), 'Gemini thought parts are hidden');
  await page.click('button:has-text("Similar practice problems")');
  await page.waitForSelector('summary:has-text("Show answers")');
  check(true, 'Practice problems with hidden answers');
  await page.screenshot({ path: `${SHOTS}/03-solve.png`, fullPage: true });
  check((await page.locator('[data-solve-id]').count()) === 1, 'Solve saved to history');

  // Follow-up chat
  await page.click('button:has-text("Ask a follow-up")');
  await page.waitForURL('**/ai/chat');
  check((await page.locator('#chatMessages .md').count()) >= 1, 'Follow-up chat seeded with the solution');
  await page.fill('#chatInput', 'Explain step 2');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#chatMessages .md').length >= 2 && !document.querySelector('#chatMessages .streaming'));
  const chatCall = calls.at(-1);
  check(chatCall.contents.length === 3 && chatCall.contents[1].role === 'model', 'Chat history sent with Gemini roles');
  await page.click('[role=radio]:has-text("Talk it through")');
  check(await page.getByText('How are you doing, really?').isVisible(), 'Support mode');
  await page.click('button:has-text("I can’t focus today")');
  await page.waitForTimeout(800);
  check(calls.at(-1).system.includes('988'), 'Support mode uses wellbeing prompt');
  await page.screenshot({ path: `${SHOTS}/04-chat.png` });

  // Concepts
  await page.click('a[href="/ai/concepts"]');
  await page.waitForSelector('[data-concept-card]');
  check((await page.locator('[data-concept-card]').count()) === 2, 'Concept cards created from solve');
  await page.fill('input[aria-label="New concept"]', 'photosynthesis');
  await page.click('form button:has-text("Add")');
  await page.waitForFunction(() => document.querySelectorAll('[data-concept-card]').length === 3);
  check(await page.getByText('Plants turn light').isVisible(), 'Manual concept gets AI summary');
  await page.locator('[data-concept="quiz"]').first().click();
  await page.waitForSelector('[data-cq-choice]');
  await page.click('[data-cq-choice="1"]');
  await page.click('[data-cq="next"]');
  await page.click('[data-cq-choice="0"]');
  await page.click('[data-cq="next"]');
  check((await page.textContent('#conceptDialogBody')).includes('2 of 2 correct'), 'Concept quiz scores');
  await page.click('[data-cq="close"]');
  await page.click('button:has-text("Find my gaps")');
  await page.waitForTimeout(800);
  check((await page.locator('#conceptGapOutput .md').count()) === 1, 'Gap analysis shown');
  await page.locator('button:has-text("Go deeper")').first().click();
  await page.waitForURL('**/ai/chat');
  await page.waitForFunction(() => [...document.querySelectorAll('#chatMessages div')].some((d) => d.textContent.includes('deeper breakdown')));
  check(true, 'Go deeper opens a chat with the question');

  // Notes
  await page.click('a[href="/ai/notes"]');
  await page.fill('#notesTitle', 'Cell bio');
  await page.fill('#notesText', 'Mitochondria make ATP.');
  await page.click('[role=radio]:has-text("Cheatsheet")');
  await page.click('button:has-text("Generate")');
  await page.waitForSelector('button:has-text("Download PDF")');
  await page.click('button:has-text("Download PDF")');
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__printed)) === 1, 'PDF export opens print');
  await page.click('button:has-text("← All notes")');
  check((await page.locator('[data-note-id]').count()) >= 1, 'Notes library lists notes');
  await page.click('[role=radio]:has-text("Flashcards")');
  await page.click('button:has-text("Generate")');
  await page.waitForSelector('text=6 flashcards added');
  check(true, 'Flashcards from notes');
  await page.screenshot({ path: `${SHOTS}/05-notes.png`, fullPage: true });

  // Assignment helper
  await page.click('a[href="/ai/assignments"]');
  await page.setInputFiles('#assignFile', [{ name: 'p1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') }, { name: 'p2.txt', mimeType: 'text/plain', buffer: Buffer.from('Question 2') }]);
  await page.waitForSelector('text=p2.txt');
  await page.click('button:has-text("Build my study guide")');
  await page.waitForSelector('#assignOutput input[type=checkbox]');
  check((await page.locator('#assignOutput input[type=checkbox]').count()) === 2, 'Checklist rendered');
  check(calls.some((c) => c.contents?.[0]?.parts?.some((p) => p.inline_data?.mime_type === 'application/pdf')), 'PDF sent to Gemini');
  await page.screenshot({ path: `${SHOTS}/06-assign.png`, fullPage: true });

  // Writing
  await page.click('a[href="/ai/writing"]');
  await page.fill('#writeText', 'This is my essay about things.');
  check(await page.getByText('6 words').isVisible(), 'Word count');
  await page.click('button:has-text("Review my writing")');
  await page.waitForSelector('#writeOutput .md');
  check(true, 'Writing feedback');

  // Games
  await page.click('aside a[href="/games"]');
  await page.waitForSelector('text=Smart review ·');
  check(true, 'Smart review default');
  await page.keyboard.press('Space');
  await page.waitForSelector('button:has-text("Again")');
  check((await page.locator('button:has-text("Again")').count()) === 1, 'Ratings shown after flip');
  const before = await page.textContent('text=/\\d+ left/');
  await page.keyboard.press('3');
  check((await page.textContent('text=/\\d+ left/')) !== before, 'Rating advances the queue');
  await page.click('[role=tab]:has-text("Speed round")');
  await page.click('button:has-text("Start")');
  check(/\d+s/.test(await page.textContent('.min-h-64')), 'Speed round running');
  await page.locator('article', { hasText: 'Cell Structure' }).locator('button').click();
  check((await page.textContent('body')).includes('10 cards · 10 due'), 'Starter deck imported');
  await page.click('summary:has-text("Paste many cards")');
  await page.fill('textarea[placeholder^="Mitosis"]', 'A - B\nC: D\nE\tF\nbad');
  await page.click('button:has-text("Add cards")');
  check((await page.textContent('body')).includes('13 cards'), 'Bulk add parses three lines');
  await page.fill('input[aria-label="Topic for AI flashcards"]', 'French Revolution');
  await page.click('details button:has-text("Generate")');
  await page.waitForSelector('text=6 cards · 6 due');
  check(true, 'AI-generated set');
  await page.screenshot({ path: `${SHOTS}/07-games.png`, fullPage: true });

  // Planner
  await page.click('aside a[href="/planner"]');
  await page.fill('#reminderTitle', 'Chem problem set');
  await page.click('button:has-text("Add reminder")');
  check((await page.textContent('body')).includes('Chem problem set'), 'Reminder added');
  await page.click('summary:has-text("Having trouble")');
  await page.fill('textarea[placeholder^="Week 3"]', 'Homework 4 due March 3, 2099\nMidterm exam 3/20/2099');
  await page.click('button:has-text("Scan pasted text")');
  check((await page.locator('input[aria-label="Assignment title"]').count()) === 2, 'Syllabus scanner finds deadlines');
  await page.click('button:has-text("Find with AI")');
  await page.waitForSelector('input[value="Lab report 2"]');
  check(true, 'AI syllabus extraction');
  await page.click('button:has-text("Add selected to Planner")');
  check((await page.textContent('body')).includes('Lab report 2'), 'Imported deadlines appear in reminders');
  await page.screenshot({ path: `${SHOTS}/08-planner.png`, fullPage: true });

  // Focus timer with a fake clock
  await page.clock.install();
  await page.click('aside a[href="/focus"]');
  await page.click('[role=radio]:has-text("15")');
  await page.fill('#subject', 'Calculus');
  await page.click('button:has-text("Start focusing")');
  await page.clock.fastForward('15:02');
  await page.waitForSelector('text=How did it go?', { timeout: 5000 });
  check(true, 'Focus session completes and asks for reflection');
  await page.fill('#reflectionNote', 'Finished derivatives');
  await page.click('button:has-text("Save check-in")');
  await page.waitForURL(BASE + '/');
  check((await page.textContent('body')).includes('Finished derivatives'), 'Reflection saved and shown');
  check((await page.textContent('body')).includes('Calculus'), 'Session in recent sessions');

  // Friends: circle + class with a second student
  await page.click('aside a[href="/friends"]');
  await page.click('button:has-text("Create circle")');
  await page.waitForSelector('text=/You’re in circle [A-F0-9]{8}/');
  const circleCode = (await page.textContent('text=/You’re in circle [A-F0-9]{8}/')).match(/[A-F0-9]{8}/)[0];
  check(/15 min/.test(await page.textContent('ol')), 'Circle shows this week’s minutes');
  await page.fill('#className', 'Bio review');
  await page.selectOption('#classSetSelect', { label: 'Cell Structure (13)' });
  await page.click('button:has-text("Host class")');
  await page.waitForSelector('text=/Bio review · [A-F0-9]{6}/');
  const classCode = (await page.textContent('text=/Bio review · [A-F0-9]{6}/')).match(/[A-F0-9]{6}$/)[0];
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const p2 = await ctx2.newPage();
  watch(p2, 'student2');
  await p2.goto(`${BASE}/friends?class=${classCode}&circle=${circleCode}`);
  check((await p2.inputValue('#classCodeInput')) === classCode && (await p2.inputValue('#circleCode')) === circleCode, 'Invite links prefill codes');
  await p2.fill('#classStudentName', 'Sam');
  await p2.click('button:has-text("Join class")');
  await p2.click('form button:has-text("Join")');
  await page.waitForSelector('text=2 classmates joined', { timeout: 6000 });
  await page.click('button:has-text("Start quiz")');
  await p2.waitForSelector('text=/Question 1 of 13/', { timeout: 6000 });
  const q = await p2.locator('#classStage h3').textContent();
  const correctAnswer = { Mitochondria: 'Site of cellular respiration; makes most of the cell’s ATP', Ribosome: 'Builds proteins by translating mRNA', Nucleus: 'Stores DNA and controls gene expression', 'Rough ER': 'Ribosome-studded membranes that make and fold proteins', 'Smooth ER': 'Makes lipids and detoxifies chemicals', 'Golgi apparatus': 'Modifies, sorts, and packages proteins', Lysosome: 'Digests macromolecules and worn-out organelles', Chloroplast: 'Site of photosynthesis in plants and algae', 'Cell membrane': 'Phospholipid bilayer that controls what enters and leaves', 'Cell wall': 'Rigid outer layer in plants, fungi, and bacteria', A: 'B', C: 'D', E: 'F' }[q];
  await p2.click(`#classStage button:has-text("${correctAnswer}")`);
  await p2.waitForSelector('text=Answer saved');
  await page.click('button:has-text("Reveal answer")');
  await p2.waitForSelector('text=Sam', { timeout: 6000 });
  await p2.waitForFunction(() => document.body.textContent.includes('100 pts'), null, { timeout: 6000 });
  check(true, 'Live class round scored for the second student');
  await page.screenshot({ path: `${SHOTS}/09-friends.png`, fullPage: true });

  // Leaderboards
  await page.click('aside a[href="/leaderboards"]');
  await page.fill('#leaderboardSchool', 'State U');
  await page.selectOption('#leaderboardMajor', 'Biology');
  await page.click('button:has-text("Save my groups")');
  await page.waitForSelector('#leaderboardScopeList li', { timeout: 6000 });
  check((await page.textContent('#leaderboardScopeList')).includes('15 min'), 'School leaderboard lists this student');
  await page.click('[role=radio]:has-text("Class")');
  await page.waitForFunction(() => document.querySelector('#leaderboardScopeList')?.textContent.includes('quiz pts'), null, { timeout: 6000 });
  check(true, 'Class leaderboard shows quiz points');

  // Shared decks between students
  await page.click('aside a[href="/games"]');
  page.once('dialog', (d) => d.accept());
  await page.click('button:has-text("Share to library")');
  await page.waitForTimeout(400);
  await p2.goto(`${BASE}/games`);
  await p2.click('[role=radio]:has-text("Shared by students")');
  await p2.waitForSelector('text=/by Student/');
  check(true, 'Shared deck visible to another student');

  // Backup export
  await page.click('aside a[href="/settings"]');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export backup")')]);
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  check(backup.app === 'studytime' && Object.keys(backup.ai.keys).length === 0 && backup.profile.sessions.length === 1, 'Backup exports progress without API keys');

  // Dark mode + mobile
  await page.click('button[aria-pressed]:has-text("Dark mode")');
  await page.click('aside a[href="/ai"]');
  await page.screenshot({ path: `${SHOTS}/10-dark.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const href of ['/', '/ai', '/games', '/planner', '/friends', '/settings']) {
    await page.click(`nav[aria-label="Mobile navigation"] a[href="${href}"]`).catch(() => page.goto(BASE + href));
    await page.waitForTimeout(200);
    check(await noHScroll(page), `No horizontal scroll on mobile ${href}`);
  }
  await page.goto(`${BASE}/ai`);
  await page.screenshot({ path: `${SHOTS}/11-mobile-dark.png`, fullPage: true });
  await page.click('button[aria-pressed]:has-text("Light mode")').catch(() => {});

  // Data persists after reload
  await page.goto(`${BASE}/ai`);
  check((await page.locator('[data-solve-id]').count()) === 1, 'AI history persists after reload');

  // Legacy data from the original HTML app migrates
  const ctx3 = await browser.newContext();
  await ctx3.addInitScript(() => {
    if (!localStorage.getItem('studytime:profile')) localStorage.setItem('studytime-v1', JSON.stringify({ name: 'Legacy Lee', points: 77, sessions: [], theme: 'dark', accent: '#558cb7' }));
  });
  const p3 = await ctx3.newPage();
  watch(p3, 'legacy');
  await p3.goto(BASE);
  await p3.waitForSelector('text=Legacy Lee');
  check((await p3.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'Legacy profile and theme migrate');
  await ctx3.close();
  await ctx2.close();
  await ctx.close();
} finally {
  server1.kill();
}

// ---------- Phase 2: site-provided key with an access code ----------
const server2 = await startServer(3101, { GEMINI_API_KEY: SERVER_KEY, AI_ACCESS_CODE: 'letmein', AI_RATE_LIMIT_PER_MIN: '50' });
try {
  const BASE = 'http://127.0.0.1:3101';
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'phase2');
  await page.goto(`${BASE}/ai/chat`);
  check(await page.waitForSelector('text=Google Gemini · provided by this site', { timeout: 5000 }).then(() => true, () => false), 'Site key detected');
  await page.fill('#chatInput', 'hello');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=needs an access code');
  check(true, 'Access code required for the site key');
  await page.goto(`${BASE}/settings#ai`);
  await page.fill('#aiAccess', 'letmein');
  await page.goto(`${BASE}/ai/chat`);
  await page.fill('#chatInput', 'hello again');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#chatMessages .md').length >= 1 && !document.querySelector('#chatMessages .streaming'));
  check(calls.at(-1).key === SERVER_KEY, 'Request used the site key');
  const status = await page.evaluate(async () => (await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'gemini', model: 'x', messages: [] }) })).status);
  check(status === 400, 'API validates requests');
  // Groq (text only) refuses images with a clear message
  await page.goto(`${BASE}/settings#ai`);
  await page.click('[role=radio]:has-text("Groq")');
  await page.fill('#aiKeyInput', 'gsk_test-key-abcdefghijklmnopqrstuvwxyz');
  await page.click('button:has-text("Save key")');
  await page.goto(`${BASE}/ai`);
  await page.setInputFiles('#solveFile', { name: 'hw.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.waitForSelector('img[alt=""]');
  await page.click('button:has-text("Solve it")');
  check(await page.getByText('can’t read photos').isVisible(), 'Text-only provider explains photo limits');
  await page.click('button[aria-label^="Remove"]');
  await page.fill('#solveText', 'derivative of x^2 sin x');
  await page.click('button:has-text("Solve it")');
  await page.waitForSelector('#solveOutput .md', { timeout: 8000 });
  check(calls.some((c) => c.provider === 'groq' && c.model === 'openai/gpt-oss-120b'), 'Groq (OpenAI-compatible) streaming works');
  await ctx.close();
} finally {
  server2.kill();
  await browser.close();
  stub.close();
}

console.log('\nPage errors:', errors.length ? errors : 'none');
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures || errors.length ? 1 : 0);
