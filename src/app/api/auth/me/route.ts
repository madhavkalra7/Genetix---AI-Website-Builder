import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ user: null });
    }

    const session = await getSessionByToken(sessionToken);

    if (!session) {
      const response = NextResponse.json({ user: null });
      response.cookies.delete('session_token');
      return response;
    }

    return NextResponse.json({ user: session.user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ user: null });
  }
}
