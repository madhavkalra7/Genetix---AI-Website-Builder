import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { aiquestShadowEmail, verifyAiquestTicket } from '@/lib/aiquest';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get('ticket') || '';
  const handoff = verifyAiquestTicket(ticket);
  if (!handoff) return NextResponse.json({ error: 'Invalid or expired AIQuest handoff' }, { status: 401 });

  try {
    const user = await prisma.$transaction(async (tx) => {
      await tx.aiquestHandoffUse.create({ data: { jti: handoff.jti, expiresAt: new Date(handoff.exp * 1000) } });
      return tx.user.upsert({
        where: { aiquestUserId: handoff.sub },
        update: { firstName: handoff.name || 'Explorer' },
        create: {
          aiquestUserId: handoff.sub,
          email: aiquestShadowEmail(handoff.sub),
          firstName: handoff.name || 'Explorer',
          emailVerified: false,
        },
      });
    });
    const session = await createSession(user.id, request.headers.get('user-agent') || undefined);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('session_token', session.token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, path: '/',
    });
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('AIQuest handoff failed:', error);
    return NextResponse.json({ error: 'AIQuest handoff was already used or could not be completed' }, { status: 400 });
  }
}
