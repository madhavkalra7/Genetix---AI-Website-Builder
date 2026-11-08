import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPasswordResetToken } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';

const resetSchema = z.object({
  token: z.string().min(1, 'Reset token is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200, 'Password is too long'),
});

const INVALID_LINK = 'This password reset link is invalid or has expired. Please request a new one.';

class InvalidTokenError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(`reset-password:${getClientIp(request)}`, 10, 15 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec, `Too many attempts. Please try again in ${rl.retryAfterSec} seconds.`);
    }

    const body = await request.json().catch(() => ({}));
    const { token, password } = resetSchema.parse(body);

    const reset = await verifyPasswordResetToken(token);
    if (!reset || !reset.user.isActive) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const userId = reset.userId;

    await prisma.$transaction(async (tx) => {
      // Atomic single-use claim: a concurrent request with the same token gets count 0.
      const claimed = await tx.passwordReset.updateMany({
        where: { token, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
      });
      if (claimed.count !== 1) throw new InvalidTokenError();

      await tx.user.update({
        where: { id: userId },
        // Following the emailed link proves inbox ownership, so the email counts as verified.
        data: { passwordHash, emailVerified: true },
      });
      // Every other outstanding reset link and pending verification link is now stale.
      await tx.passwordReset.deleteMany({ where: { userId, token: { not: token } } });
      await tx.verificationToken.deleteMany({ where: { userId, type: 'EMAIL_VERIFICATION' } });
      // Sign out everywhere (someone else may have known the old password).
      await tx.session.deleteMany({ where: { userId } });
    });

    const response = NextResponse.json({
      success: true,
      message: 'Your password has been reset. You can now sign in with your new password.',
    });
    response.cookies.delete('session_token');
    return response;
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
