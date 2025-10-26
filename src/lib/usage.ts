import { prisma } from "@/lib/db";
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";

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

export async function consumeCredits() {
  const user = await getCurrentUser();

  if (!user) {
    console.error("❌ consumeCredits: User not authenticated");
    throw new Error("User not authenticated");
  }

  console.log("✅ consumeCredits: User found:", user.email);
  
  // Get or create user credits
  let userCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id },
  });

  // If no credits record exists, create one with free plan (3 credits)
  if (!userCredits) {
    userCredits = await prisma.userCredits.create({
      data: {
        userId: user.id,
        creditsUsed: 0,
        creditsLimit: 3, // Free plan default
        lastReset: new Date(),
      },
    });
    console.log("✅ Created new credits record for user");
  }

  // Check if user has enough credits
  const remainingCredits = userCredits.creditsLimit - userCredits.creditsUsed;
  
  if (remainingCredits < GENERATION_COST) {
    console.error("❌ Insufficient credits:", {
      creditsUsed: userCredits.creditsUsed,
      creditsLimit: userCredits.creditsLimit,
      remaining: remainingCredits,
    });
    throw new Error("Insufficient credits");
  }

  // Consume credits
  const updated = await prisma.userCredits.update({
    where: { userId: user.id },
    data: {
      creditsUsed: {
        increment: GENERATION_COST,
      },
    },
  });

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

export async function getUsageStatus() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // Get or create user credits
  let userCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id },
  });

  if (!userCredits) {
    userCredits = await prisma.userCredits.create({
      data: {
        userId: user.id,
        creditsUsed: 0,
        creditsLimit: 3,
        lastReset: new Date(),
      },
    });
  }

  return {
    creditsUsed: userCredits.creditsUsed,
    creditsLimit: userCredits.creditsLimit,
    remainingCredits: userCredits.creditsLimit - userCredits.creditsUsed,
  };
}