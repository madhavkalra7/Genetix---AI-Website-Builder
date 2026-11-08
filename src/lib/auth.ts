import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './db';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: string, userAgent?: string, ipAddress?: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          aiquestUserId: true,
        },
      },
    },
  });

  return session;
}

export async function getSessionByToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          isActive: true,
          aiquestUserId: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  // Deactivated users must not keep working sessions
  if (!session.user.isActive) return null;

  return session;
}

export async function deleteSession(token: string) {
  // deleteMany: logging out with a stale/unknown token must not throw (500) and keep the cookie
  await prisma.session.deleteMany({ where: { token } });
}

export async function deleteAllUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function createVerificationToken(userId: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET') {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return prisma.verificationToken.create({
    data: {
      userId,
      token,
      type,
      expiresAt,
    },
  });
}

export async function verifyToken(token: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET') {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken || verificationToken.type !== type) {
    return null;
  }

  if (verificationToken.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
    return null;
  }

  return verificationToken;
}

/**
 * LEGACY RULE: email verification for credentials signup was introduced on 2026-11-08.
 * Accounts created before that moment never received a verification email and have
 * emailVerified=false in the DB. Rather than mass-updating rows with a migration, any user
 * created before this cutoff is treated as verified. Accounts created after it must verify.
 */
export const EMAIL_VERIFICATION_CUTOFF = new Date('2026-11-08T00:00:00Z');

export function isEmailVerified(user: { emailVerified: boolean; createdAt: Date }): boolean {
  return user.emailVerified || user.createdAt < EMAIL_VERIFICATION_CUTOFF;
}

/** Minimum gap between two verification emails for the same user. */
export const VERIFICATION_RESEND_INTERVAL_MS = 60 * 1000;

/** Most recent EMAIL_VERIFICATION token for a user, if any (used for rate limiting). */
export async function getLatestEmailVerificationToken(userId: string) {
  return prisma.verificationToken.findFirst({
    where: { userId, type: 'EMAIL_VERIFICATION' },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Replaces any outstanding EMAIL_VERIFICATION tokens for the user with a fresh one, so only
 * the most recently sent link works (important when an unverified signup is overwritten).
 */
export async function createEmailVerificationToken(userId: string) {
  await prisma.verificationToken.deleteMany({ where: { userId, type: 'EMAIL_VERIFICATION' } });
  return createVerificationToken(userId, 'EMAIL_VERIFICATION');
}

/** Replaces any outstanding (unused) password-reset tokens with a fresh one, so only the newest link works. */
export async function createFreshPasswordReset(userId: string) {
  await prisma.passwordReset.deleteMany({ where: { userId, used: false } });
  return createPasswordReset(userId);
}

export async function createPasswordReset(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  return prisma.passwordReset.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
}

export async function verifyPasswordResetToken(token: string) {
  const resetToken = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.used) {
    return null;
  }

  if (resetToken.expiresAt < new Date()) {
    await prisma.passwordReset.delete({ where: { id: resetToken.id } });
    return null;
  }

  return resetToken;
}

export async function markPasswordResetAsUsed(token: string) {
  await prisma.passwordReset.update({
    where: { token },
    data: { used: true },
  });
}
