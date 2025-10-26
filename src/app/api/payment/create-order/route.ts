import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";
import { prisma } from "@/lib/db";
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";

// Mark as dynamic route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log("🔵 Payment API called");

    // Check authentication
    const nextAuthSession = await getServerSession(authOptions);
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    const customSession = sessionToken ? await getSessionByToken(sessionToken) : null;

    let userEmail: string | null = null;
    let userName: string | null = null;
    let userId: string | null = null;

    if (nextAuthSession?.user?.email) {
      userEmail = nextAuthSession.user.email;
      userName = nextAuthSession.user.name || userEmail.split('@')[0];
      const dbUser = await prisma.user.findUnique({
        where: { email: userEmail }
      });
      userId = dbUser?.id || null;
    } else if (customSession?.user) {
      userEmail = customSession.user.email;
      userName = customSession.user.firstName || customSession.user.username || userEmail.split('@')[0];
      userId = customSession.user.id;
    }

    if (!userEmail || !userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { planName, amount } = await request.json();

    console.log("📦 Request payload:", { planName, amount });

    // Get plan details by name
    const plan = await prisma.plan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      console.error("❌ Plan not found:", planName);
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    console.log("✅ Plan found:", plan.displayName);

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${userId.substring(0, 8)}`;

    // Store pending payment in database
    await prisma.payment.create({
      data: {
        userId: userId,
        planId: plan.id,
        amount: plan.price,
        currency: "INR",
        status: "PENDING",
        transactionId: orderId,
        paymentMethod: "phonepe",
        description: `Payment for ${plan.displayName} plan`,
        metadata: {
          planId: plan.id,
          planName: plan.name,
          orderId: orderId,
          userName: userName,
          userEmail: userEmail,
        },
      },
    });

    console.log("✅ Payment record created:", orderId);

    return NextResponse.json({
      success: true,
      order_id: orderId,
      message: "Payment record created. Redirecting to payment page...",
    });
  } catch (error) {
    console.error("💥 Error in payment flow:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Failed to create payment request" },
      { status: 500 }
    );
  }
}
