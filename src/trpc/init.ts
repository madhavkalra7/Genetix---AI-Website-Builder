import { initTRPC, TRPCError } from '@trpc/server';
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { cache } from 'react';
import superjson from 'superjson';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";
import { prisma } from "@/lib/db";

export const createTRPCContext = cache(async () => {
  // Check NextAuth session first
  const nextAuthSession = await getServerSession(authOptions);
  
  if (nextAuthSession?.user?.email) {
    // Fetch the actual user from database to get their UUID
    const dbUser = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email }
    });
    
    if (dbUser) {
      return {
        auth: {
          userId: dbUser.id, // Use actual UUID from database
          user: nextAuthSession.user,
          isNextAuth: true,
        },
      };
    }
  }
  
  // Check custom auth session
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  
  if (!sessionToken) {
    return { auth: { userId: null, user: null, isNextAuth: false } };
  }

  const session = await getSessionByToken(sessionToken);
  
  return {
    auth: {
      userId: session?.user.id || null,
      user: session?.user || null,
      isNextAuth: false,
    },
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson, 
});

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return next({
    ctx: {
      auth: ctx.auth,
    },
  });
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure=t.procedure.use(isAuthed);