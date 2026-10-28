import 'server-only';
import { HttpError } from './http';

/**
 * Email through Resend (resend.com, free for 3,000 emails a month).
 * Needs RESEND_API_KEY and EMAIL_FROM, for example "Studytime <hello@yourdomain.com>".
 */
export const emailReady = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A plain, readable email: a heading, paragraphs, and an optional button. */
export function emailHtml(input: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; footer?: string }) {
  const p = input.paragraphs.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#3f3f46">${escape(t)}</p>`).join('');
  const b = input.button ? `<p style="margin:22px 0"><a href="${escape(input.button.url)}" style="display:inline-block;background:#2f5bd3;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 18px;border-radius:8px">${escape(input.button.label)}</a></p>` : '';
  const f = input.footer ? `<p style="margin:28px 0 0;font-size:12px;line-height:18px;color:#a1a1aa">${escape(input.footer)}</p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px 12px;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px"><p style="margin:0 0 18px;font-size:14px;font-weight:700;color:#18181b">Studytime</p><h1 style="margin:0 0 14px;font-size:21px;line-height:28px;color:#18181b">${escape(input.heading)}</h1>${p}${b}${f}</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!emailReady()) throw new HttpError(503, 'Email is not set up on this site yet.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    console.error('Email failed', res.status, body.message);
    throw new HttpError(502, 'Could not send the email. Try again in a minute.');
  }
}

/** The site address for links in emails. */
export const siteUrl = (request: Request) => (process.env.SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin);
