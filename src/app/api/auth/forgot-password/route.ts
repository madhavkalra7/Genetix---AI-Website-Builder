import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createFreshPasswordReset } from '@/lib/auth';
import { isSmtpConfigured, sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';

const forgotSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(320),
});

// Always the same answer, so this endpoint can't be used to discover which emails have accounts.
const GENERIC_MESSAGE = 'If an account exists for this email, we sent a link to reset your password. It expires in 1 hour.';

export async function POST(request: NextRequest) {
  try {
    // 5 requests / hour per IP (each one can send an email).
    const rl = await checkRateLimit(`forgot-password:${getClientIp(request)}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec, `Too many requests. Please try again in ${rl.retryAfterSec} seconds.`);
    }

    const body = await request.json().catch(() => ({}));
    const { email } = forgotSchema.parse(body);

    // Not account-specific, so this doesn't leak whether the email exists.
    if (!isSmtpConfigured() && process.env.NODE_ENV === 'production') {
      console.error('Forgot password: SMTP is not configured, cannot send reset emails.');
      return NextResponse.json(
        { error: 'Password reset is currently unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Credentials users (have a password) or users whose inbox is already verified. Deactivated
    // accounts and AIQuest shadow accounts are skipped silently.
    const eligible = !!user && user.isActive && !user.aiquestUserId && (!!user.passwordHash || user.emailVerified);

    if (user && eligible) {
      // Per-account cap too, so one inbox can't be flooded from many IPs.
      const perUser = await checkRateLimit(`forgot-password-user:${user.id}`, 3, 60 * 60 * 1000);
      if (perUser.ok) {
        const reset = await createFreshPasswordReset(user.id);
        try {
          await sendPasswordResetEmail(user.email, reset.token);
        } catch (mailError) {
          // Don't change the response: a different answer would reveal that the account exists.
          console.error('Failed to send password reset email:', mailError);
        }
      }
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
