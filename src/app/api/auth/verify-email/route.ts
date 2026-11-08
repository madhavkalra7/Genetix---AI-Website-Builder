import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken, verifyPassword } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { grantReferralRewardIfEligible } from '@/modules/referrals/server/service';
import { z } from 'zod';

export const runtime = 'nodejs';

const verifySchema = z.object({
  token: z.string().min(1, 'Verification token is required').max(200),
  password: z.string().min(1, 'Please enter the password you chose when signing up').max(200),
});

const PASSWORD_MISMATCH = "Password doesn't match this sign-up. If this wasn't you, sign up again.";

class TokenAlreadyUsedError extends Error {}

// POST (not GET) on purpose: email link scanners prefetch GET URLs, which would silently consume
// the token. The /auth/verify-email page reads the token from the link and POSTs it here.
//
// SECURITY: the request must also carry the password chosen at sign-up. Unverified emails can be
// re-registered (so a squatter can't block the real owner), which means the newest link in the
// victim's inbox might belong to an attacker's sign-up. Requiring the password makes such a link
// useless to the inbox owner, so they can't accidentally verify an account whose password the
// attacker knows. The token is only consumed on success.
export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(`verify-email:${getClientIp(request)}`, 20, 15 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec, `Too many attempts. Please try again in ${rl.retryAfterSec} seconds.`);
    }

    const body = await request.json().catch(() => ({}));
    const { token, password } = verifySchema.parse(body);

    const verification = await verifyToken(token, 'EMAIL_VERIFICATION');
    if (!verification) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const passwordHash = verification.user.passwordHash;
    if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
      return NextResponse.json({ error: PASSWORD_MISMATCH }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Single-use: if a re-signup replaced this token (or it was already used) since we read it,
      // the delete matches nothing and we refuse.
      const consumed = await tx.verificationToken.deleteMany({
        where: { token, userId: verification.userId, type: 'EMAIL_VERIFICATION' },
      });
      if (consumed.count !== 1) throw new TokenAlreadyUsedError();
      // The password may have changed between the check above and now (re-signup); re-check.
      const current = await tx.user.findUnique({ where: { id: verification.userId }, select: { passwordHash: true } });
      if (current?.passwordHash !== passwordHash) throw new TokenAlreadyUsedError();

      await tx.user.update({
        where: { id: verification.userId },
        data: { emailVerified: true },
      });
      await tx.verificationToken.deleteMany({
        where: { userId: verification.userId, type: 'EMAIL_VERIFICATION' },
      });
    });

    // Referral credits are only paid out once the invited user has proven their email.
    await grantReferralRewardIfEligible(verification.userId);

    return NextResponse.json({
      success: true,
      email: verification.user.email,
      message: 'Your email has been verified. You can now sign in.',
    });
  } catch (error) {
    if (error instanceof TokenAlreadyUsedError) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Email verification error:', error);
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
  }
}
