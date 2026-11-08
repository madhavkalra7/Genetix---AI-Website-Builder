import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";
import { getSessionByToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Resolve the logged-in user's id for API route handlers.
 * Mirrors the tRPC context: custom session cookie (incl. AIQuest) or NextAuth session.
 */
export async function getRequestUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  const customSession = sessionToken ? await getSessionByToken(sessionToken) : null;
  if (customSession?.user?.id) return customSession.user.id;

  const nextAuthSession = await getServerSession(authOptions);
  if (nextAuthSession?.user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email },
      select: { id: true, isActive: true },
    });
    if (dbUser?.isActive === false) return null;
    return dbUser?.id ?? null;
  }
  return null;
}
