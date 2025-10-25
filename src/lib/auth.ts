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
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function deleteSession(token: string) {
  await prisma.session.delete({ where: { token } });
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
