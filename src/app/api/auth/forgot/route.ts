import { z } from 'zod';
import { createResetToken, findByEmail, normEmail } from '@/lib/server/accounts';
import { emailHtml, emailReady, sendEmail, siteUrl } from '@/lib/server/email';
import { clientIp, handle, HttpError, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';

/** Email a password reset link. Answers the same whether or not the email has an account. */
export const POST = handle(async (request: Request) => {
  if (!emailReady()) throw new HttpError(503, 'Password reset by email is not set up on this site yet. Ask the person who runs it to reset your password.');
  const { email } = await readJson(request, z.object({ email: z.string().trim().email('Enter a valid email').max(200) }));
  await rateLimit('forgot', clientIp(request), 5, 3600, 'Too many reset requests. Try again in an hour.');
  await rateLimit('forgot-email', normEmail(email), 3, 3600, 'We already sent a few links. Check your inbox and spam folder.');
  const a = await findByEmail(email);
  if (a) {
    const link = `${siteUrl(request)}/reset?token=${await createResetToken(a.id)}`;
    await sendEmail(
      a.email,
      'Reset your Studytime password',
      emailHtml({ heading: 'Reset your password', paragraphs: [`Hi ${a.name}, someone asked to reset the password for your Studytime account.`, 'The link works once and expires in an hour.'], button: { label: 'Choose a new password', url: link }, footer: 'If you did not ask for this, ignore this email. Your password stays the same.' }),
      `Reset your Studytime password: ${link}\n\nThe link works once and expires in an hour. If you did not ask for this, ignore this email.`,
    );
  }
  return json({ ok: true });
});
