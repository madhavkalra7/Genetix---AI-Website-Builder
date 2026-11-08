import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession, isEmailVerified } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signInSchema.parse(body);

    // Brute-force protection: 10 attempts / 15 min per IP + email.
    const rl = await checkRateLimit(
      `signin:${getClientIp(request)}:${validatedData.email.trim().toLowerCase()}`,
      10,
      15 * 60 * 1000
    );
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec, `Too many sign-in attempts. Please try again in ${rl.retryAfterSec} seconds.`);
    }

    // Find user
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Auto-create/sync admin user if credentials match .env config
    if (adminEmail && adminPassword && validatedData.email === adminEmail && validatedData.password === adminPassword) {
      let adminUser = await prisma.user.findUnique({
        where: { email: adminEmail }
      });

      const { hashPassword } = await import('@/lib/auth');
      const expectedHash = await hashPassword(adminPassword);

      if (!adminUser) {
        await prisma.user.create({
          data: {
            email: adminEmail,
            firstName: "Admin",
            lastName: "User",
            passwordHash: expectedHash,
            emailVerified: true,
            credits: {
              create: {
                creditsLimit: 9999,
                creditsUsed: 0,
                lastReset: new Date()
              }
            }
          }
        });
        console.log("🚀 Admin user auto-created successfully!");
      } else {
        // Ensure database password matches current .env password
        const { verifyPassword } = await import('@/lib/auth');
        const isCurrentMatch = adminUser.passwordHash ? await verifyPassword(adminPassword, adminUser.passwordHash) : false;
        // The admin proved knowledge of ADMIN_PASSWORD from .env, so also mark the admin email as
        // verified (the admin row may predate email verification or have been created elsewhere).
        if (!isCurrentMatch || !adminUser.emailVerified) {
          await prisma.user.update({
            where: { email: adminEmail },
            data: {
              ...(!isCurrentMatch ? { passwordHash: expectedHash } : {}),
              emailVerified: true,
            }
          });
          console.log("🚀 Admin user synced with current .env configuration!");
        }
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Check if user has a password (OAuth users don't have passwords)
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account uses OAuth login. Please sign in with Google or GitHub.' },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.passwordHash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Require a verified email (users created before the verification cutoff count as verified,
    // see isEmailVerified). Checked after the password so this doesn't reveal account state.
    if (!isEmailVerified(user)) {
      return NextResponse.json(
        {
          error: 'Please verify your email first. Check your inbox for the verification link.',
          code: 'EMAIL_NOT_VERIFIED',
          emailNotVerified: true,
        },
        { status: 403 }
      );
    }

    // Create session
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || undefined;
    
    const session = await createSession(user.id, userAgent, ipAddress);

    // Set cookie
    const response = NextResponse.json({ 
      success: true, 
      user: session.user 
    });
    
    response.cookies.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Sign in error:', error);
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    );
  }
}
