import { prisma } from "@/lib/db";
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";
import { consumeAiquestIteration } from '@/lib/aiquest';
import { getAvailableCredits } from "@/lib/credits";

const GENERATION_COST = 1;

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  const aiquestSession = sessionToken ? await getSessionByToken(sessionToken) : null;
  if (aiquestSession?.user.aiquestUserId) return aiquestSession.user;
  
  // Check NextAuth session first (OAuth)
  const nextAuthSession = await getServerSession(authOptions);
  if (nextAuthSession?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email }
    });
    if (user) return user;
  }
  
  // Fallback to custom auth session
  if (!sessionToken) {
    return null;
  }

  const session = await getSessionByToken(sessionToken);
  return session?.user || null;
}

/**
 * @deprecated Charges immediately from the request's session. Builds no longer use this:
 * they check affordability with assertCanAffordBuild and are charged on success by the
 * pipeline (src/lib/credits.ts). Kept for any non-build caller.
 */
export async function consumeCredits(amount: number = 1) {
  const user = await getCurrentUser();

  if (!user) {
    console.error("❌ consumeCredits: User not authenticated");
    throw new Error("User not authenticated");
  }

  if (user.aiquestUserId) return consumeAiquestIteration(user.id);

  console.log("✅ consumeCredits: User found:", user.email, "deducting:", amount);
  
  // Get or create user credits (free plan: 3 credits). upsert avoids a create race.
  await prisma.userCredits.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      creditsUsed: 0,
      creditsLimit: 3, // Free plan default
      lastReset: new Date(),
    },
  });

  // Atomic check-and-consume (compare-and-swap on creditsUsed) so parallel requests
  // can't all pass the balance check and overspend.
  let updated: { creditsUsed: number; creditsLimit: number } | null = null;
  for (let attempt = 0; attempt < 5 && !updated; attempt++) {
    const current = await prisma.userCredits.findUniqueOrThrow({ where: { userId: user.id } });
    const remainingCredits = current.creditsLimit - current.creditsUsed;

    if (remainingCredits < amount) {
      console.error("❌ Insufficient credits:", {
        creditsUsed: current.creditsUsed,
        creditsLimit: current.creditsLimit,
        remaining: remainingCredits,
        required: amount,
      });
      throw new Error("Insufficient credits");
    }

    const { count } = await prisma.userCredits.updateMany({
      where: { userId: user.id, creditsUsed: current.creditsUsed },
      data: { creditsUsed: { increment: amount } },
    });
    if (count === 1) {
      updated = { creditsUsed: current.creditsUsed + amount, creditsLimit: current.creditsLimit };
    }
  }
  if (!updated) throw new Error("Could not consume credits, please try again");

  console.log("✅ Credits consumed successfully:", {
    used: updated.creditsUsed,
    limit: updated.creditsLimit,
    remaining: updated.creditsLimit - updated.creditsUsed,
  });

  return {
    creditsUsed: updated.creditsUsed,
    creditsLimit: updated.creditsLimit,
    remainingCredits: updated.creditsLimit - updated.creditsUsed,
  };
}

/**
 * Balance shown in the UI. Credits are charged when a build succeeds, so builds that are still
 * running/queued are subtracted here as "reserved" (remainingCredits = what can still be spent).
 */
export async function getUsageStatus() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const balance = await getAvailableCredits(user.id);
  return {
    creditsUsed: balance.used,
    creditsLimit: balance.limit,
    remainingCredits: Math.max(0, balance.available),
    reservedCredits: balance.reserved,
    aiquestMode: balance.aiquestMode,
  };
}
