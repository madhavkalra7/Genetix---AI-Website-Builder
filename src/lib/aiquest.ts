import 'server-only';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';

export const AIQUEST_LIMIT = 3;

type Handoff = { iss: string; aud: string; sub: string; name: string; jti: string; exp: number };

export function verifyAiquestTicket(ticket: string): Handoff | null {
  const secret = process.env.AIQUEST_HANDOFF_SECRET;
  if (!secret || secret.length < 32 || ticket.length > 2048) return null;
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = createHmac('sha256', secret).update(body).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Handoff;
    if (payload.iss !== 'aiquest' || payload.aud !== 'genetix-world6') return null;
    if (typeof payload.sub !== 'string' || !/^[a-f0-9]{24}$/.test(payload.sub)) return null;
    if (typeof payload.jti !== 'string' || !/^[a-f0-9]{32}$/.test(payload.jti)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.name !== 'string' || payload.name.length > 80) return null;
    return payload;
  } catch { return null; }
}

export function aiquestShadowEmail(aiquestUserId: string): string {
  const hash = createHash('sha256').update(aiquestUserId).digest('hex').slice(0, 32);
  return `aiquest-${hash}@aiquest.invalid`;
}

export async function isAiquestUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiquestUserId: true } });
  return !!user?.aiquestUserId;
}

export async function consumeAiquestIteration(userId: string) {
  const result = await prisma.user.updateMany({
    where: { id: userId, aiquestUserId: { not: null }, aiquestIterationsUsed: { lt: AIQUEST_LIMIT } },
    data: { aiquestIterationsUsed: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error('World 6 has reached its three-iteration limit.');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { aiquestIterationsUsed: true } });
  return { creditsUsed: user.aiquestIterationsUsed, creditsLimit: AIQUEST_LIMIT, remainingCredits: AIQUEST_LIMIT - user.aiquestIterationsUsed };
}

export async function refundAiquestIteration(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId, aiquestUserId: { not: null }, aiquestIterationsUsed: { gt: 0 } },
    data: { aiquestIterationsUsed: { decrement: 1 } },
  });
}
