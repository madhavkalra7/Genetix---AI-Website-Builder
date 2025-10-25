import { RateLimiterPrisma } from "rate-limiter-flexible";
import { prisma } from "@/lib/db";
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";

const FREE_POINTS = 5;
const PRO_POINTS = 100;
const DURATION = 30 * 24 * 60 * 60; // 30 days
const GENERATION_COST = 1;

async function getCurrentUser() {
  const cookieStore = await cookies();
  
  // Check NextAuth session first (OAuth)
  const nextAuthSession = await getServerSession(authOptions);
  if (nextAuthSession?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email }
    });
    if (user) return user;
  }
  
  // Fallback to custom auth session
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) {
    return null;
  }

  const session = await getSessionByToken(sessionToken);
  return session?.user || null;
}

export async function getUsageTracker() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // TODO: Check user's actual subscription from database
  // For now, everyone gets free tier
  const hasProAccess = false;

  const usageTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "Usage",
    points: hasProAccess ? PRO_POINTS : FREE_POINTS,
    duration: DURATION,
  });
  return usageTracker;
}

export async function consumeCredits() {
  const user = await getCurrentUser();

  if (!user) {
    console.error("❌ consumeCredits: User not authenticated");
    throw new Error("User not authenticated");
  }

  console.log("✅ consumeCredits: User found:", user.email);
  
  const usageTracker = await getUsageTracker();
  try {
    const result = await usageTracker.consume(user.id, GENERATION_COST);
    console.log("✅ Credits consumed successfully. Remaining:", result.remainingPoints);
    return result;
  } catch (error) {
    console.error("❌ Failed to consume credits:", error);
    throw error;
  }
}

export async function getUsageStatus() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.get(user.id);
  return result;
}