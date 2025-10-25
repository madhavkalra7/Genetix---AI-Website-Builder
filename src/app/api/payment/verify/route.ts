import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config-simple";
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
    } = await request.json();

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Get user
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

    // Get plan details
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: userId,
        amount: plan.price,
        currency: plan.currency,
        status: "SUCCESS",
        transactionId: razorpay_payment_id,
        paymentMethod: "razorpay",
        description: `Payment for ${plan.displayName} plan`,
        metadata: {
          orderId: razorpay_order_id,
          planId: planId,
        },
      },
    });

    // Create or update subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: userId },
    });

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    
    if (plan.interval === "MONTHLY") {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    if (existingSubscription) {
      await prisma.subscription.update({
        where: { userId: userId },
        data: {
          planId: planId,
          status: "ACTIVE",
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: userId,
          planId: planId,
          status: "ACTIVE",
          currentPeriodStart,
          currentPeriodEnd,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and subscription activated",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
