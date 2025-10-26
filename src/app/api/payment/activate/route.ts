import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";
import { prisma } from "@/lib/db";
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const nextAuthSession = await getServerSession(authOptions);
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    const customSession = sessionToken ? await getSessionByToken(sessionToken) : null;

    let userId: string | null = null;

    if (nextAuthSession?.user?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: nextAuthSession.user.email }
      });
      userId = dbUser?.id || null;
    } else if (customSession?.user) {
      userId = customSession.user.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { transactionId } = await request.json();

    // Find the payment
    const payment = await prisma.payment.findFirst({
      where: {
        transactionId: transactionId,
        userId: userId,
      },
      include: {
        plan: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // If already processed, return success
    if (payment.status === "SUCCESS") {
      return NextResponse.json({
        success: true,
        message: "Payment already processed",
      });
    }

    // Update payment status to SUCCESS
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS" },
    });

    // Calculate subscription period (1 month)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create or update subscription
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: payment.planId!,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        planId: payment.planId!,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Add/Update user credits
    await prisma.userCredits.upsert({
      where: { userId },
      create: {
        userId,
        creditsUsed: 0,
        creditsLimit: payment.plan?.credits || 3,
        lastReset: now,
      },
      update: {
        creditsUsed: 0, // Reset used credits
        creditsLimit: payment.plan?.credits || 3,
        lastReset: now,
      },
    });

    console.log(`✅ Subscription activated for user ${userId}`);
    console.log(`✅ Plan credits: ${payment.plan?.credits}`);

    return NextResponse.json({
      success: true,
      message: "Subscription activated successfully",
      credits: payment.plan?.credits,
    });
  } catch (error) {
    console.error("Activation error:", error);
    return NextResponse.json(
      { error: "Failed to activate subscription" },
      { status: 500 }
    );
  }
}
