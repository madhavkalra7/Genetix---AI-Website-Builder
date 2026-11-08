import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  isEmailVerified,
  createEmailVerificationToken,
  getLatestEmailVerificationToken,
  VERIFICATION_RESEND_INTERVAL_MS,
} from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Generic response so this endpoint can't be used to discover which emails have accounts.
const GENERIC_MESSAGE = 'If an unverified account exists for this email, a new verification link has been sent.';

export async function POST(request: NextRequest) {
  try {
    // 5 resend requests / hour per IP.
    const rl = await checkRateLimit(`resend-verification:${getClientIp(request)}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec, `Too many requests. Please try again in ${rl.retryAfterSec} seconds.`);
    }

    const body = await request.json();
    const { email } = resendSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || isEmailVerified(user) || !user.passwordHash || user.aiquestUserId || !user.isActive) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    // Rate limit: at most one verification email per minute per user.
    const latest = await getLatestEmailVerificationToken(user.id);
    if (latest && Date.now() - latest.createdAt.getTime() < VERIFICATION_RESEND_INTERVAL_MS) {
      return NextResponse.json(
        { error: 'Please wait a minute before requesting another verification email.' },
        { status: 429 }
      );
    }

    const verification = await createEmailVerificationToken(user.id);
    try {
      const result = await sendVerificationEmail(user.email, verification.token);
      if (result === 'unavailable') {
        return NextResponse.json(
          { error: 'Email verification is currently unavailable. Please try again later.' },
          { status: 503 }
        );
      }
    } catch (mailError) {
      console.error('Failed to resend verification email:', mailError);
      return NextResponse.json(
        { error: 'Could not send the verification email. Please try again later.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Resend verification error:', error);
    return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
  }
}
