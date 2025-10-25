import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/pricing',
  '/prompt-generator',
];

const authRoutes = [
  '/auth/signin',
  '/auth/signup',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow all API routes, NextAuth routes, and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  ) {
    return NextResponse.next();
  }

  // Check both custom session and NextAuth session
  const sessionToken = request.cookies.get('session_token')?.value;
  const nextAuthSession = request.cookies.get('next-auth.session-token')?.value || 
                          request.cookies.get('__Secure-next-auth.session-token')?.value;
  
  const isAuthenticated = !!(sessionToken || nextAuthSession);

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect unauthenticated users to sign in for protected routes
  if (!isAuthenticated && pathname.startsWith('/projects')) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};