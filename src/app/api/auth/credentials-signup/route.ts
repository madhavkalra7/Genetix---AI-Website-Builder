import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  hashPassword,
  isEmailVerified,
  deleteAllUserSessions,
  createEmailVerificationToken,
  getLatestEmailVerificationToken,
  VERIFICATION_RESEND_INTERVAL_MS,
} from '@/lib/auth';
import { isSmtpConfigured, sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const ALREADY_EXISTS = 'User with this email or username already exists';

export async function POST(request: NextRequest) {
  try {
    // 5 signups / hour per IP (each one can send an email).
    const rl = await checkRateLimit(`signup:${getClientIp(request)}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec, `Too many sign-up attempts. Please try again in ${rl.retryAfterSec} seconds.`);
    }

    const body = await request.json();
    const validatedData = signUpSchema.parse(body);

    // SECURITY: admin rights are granted by email, so the admin email must never be
    // claimable through public signup (even with email verification in place).
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && validatedData.email.trim().toLowerCase() === adminEmail) {
      return NextResponse.json({ error: ALREADY_EXISTS }, { status: 400 });
    }

    // Accounts must prove email ownership. Without SMTP in production we cannot do that, so
    // refuse signup instead of silently creating usable (effectively verified) accounts.
    if (!isSmtpConfigured() && process.env.NODE_ENV === 'production') {
      console.error('Sign up rejected: SMTP is not configured, email verification is unavailable.');
      return NextResponse.json(
        { error: 'Email verification is currently unavailable, so new accounts cannot be created. Please try again later or continue with Google/GitHub.' },
        { status: 503 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (validatedData.username) {
      const usernameOwner = await prisma.user.findUnique({
        where: { username: validatedData.username },
        select: { id: true },
      });
      if (usernameOwner && usernameOwner.id !== existingUser?.id) {
        return NextResponse.json({ error: ALREADY_EXISTS }, { status: 400 });
      }
    }

    const passwordHash = await hashPassword(validatedData.password);
    let userId: string;

    if (existingUser) {
      // Verified (or legacy) accounts, OAuth-only accounts and AIQuest shadow accounts can't be
      // taken over by signing up again.
      if (isEmailVerified(existingUser) || !existingUser.passwordHash || existingUser.aiquestUserId) {
        return NextResponse.json({ error: ALREADY_EXISTS }, { status: 400 });
      }

      // Unverified credentials account: whoever controls the inbox can re-register (e.g. lost
      // the email). This also stops someone squatting an email they don't own forever.
      const latest = await getLatestEmailVerificationToken(existingUser.id);
      if (latest && Date.now() - latest.createdAt.getTime() < VERIFICATION_RESEND_INTERVAL_MS) {
        return NextResponse.json(
          { error: 'A verification email was just sent. Please wait a minute before trying again.' },
          { status: 429 }
        );
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          username: validatedData.username ?? existingUser.username,
          firstName: validatedData.firstName ?? existingUser.firstName,
          lastName: validatedData.lastName ?? existingUser.lastName,
        },
      });
      // Unverified accounts can't log in, but clear any stray sessions to be safe.
      await deleteAllUserSessions(existingUser.id);
      userId = existingUser.id;
    } else {
      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          username: validatedData.username,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          passwordHash,
          emailVerified: false,
        },
        select: { id: true },
      });
      userId = user.id;

      // Create free plan subscription
      const freePlan = await prisma.plan.findFirst({
        where: { name: 'free' },
      });

      if (freePlan) {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          },
        });
      }
    }

    // No session is created here: the user must verify their email first.
    const verification = await createEmailVerificationToken(userId);
    try {
      const result = await sendVerificationEmail(validatedData.email, verification.token);
      if (result === 'unavailable') {
        return NextResponse.json(
          { error: 'Email verification is currently unavailable. Please try again later.' },
          { status: 503 }
        );
      }
    } catch (mailError) {
      console.error('Failed to send verification email:', mailError);
      return NextResponse.json(
        { error: 'Your account was created but we could not send the verification email. Please use "Resend verification email" on the sign-in page.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      message: 'Account created. Please check your email to verify your address before signing in.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Sign up error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
