import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';

const verifySchema = z.object({
  token: z.string().min(1, 'Verification token is required').max(200),
});

// POST (not GET) on purpose: email link scanners prefetch GET URLs, which would silently consume
// the token. The /auth/verify-email page reads the token from the link and POSTs it here.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token } = verifySchema.parse(body);

    const verification = await verifyToken(token, 'EMAIL_VERIFICATION');
    if (!verification) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerified: true },
      }),
      prisma.verificationToken.deleteMany({
        where: { userId: verification.userId, type: 'EMAIL_VERIFICATION' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      email: verification.user.email,
      message: 'Your email has been verified. You can now sign in.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Email verification error:', error);
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
  }
}
