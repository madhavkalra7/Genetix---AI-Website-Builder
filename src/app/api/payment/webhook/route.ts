import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// Mark as dynamic route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("🔔 Webhook received:", body);

    // Verify Cashfree webhook signature
    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    
    if (signature && timestamp) {
      const rawBody = JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY!)
        .update(timestamp + rawBody)
        .digest("base64");

      if (signature !== expectedSignature) {
        console.error("❌ Invalid webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 }
        );
      }
    }

    // Handle payment success event
    if (body.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const orderId = body.data?.order?.order_id;
      
      if (!orderId) {
        console.error("❌ Order ID not found in webhook");
        return NextResponse.json({ received: true });
      }

      // Verify payment with Cashfree API
      try {
        const apiUrl = process.env.CASHFREE_ENV === 'production'
          ? `https://api.cashfree.com/pg/orders/${orderId}/payments`
          : `https://sandbox.cashfree.com/pg/orders/${orderId}/payments`;

        const paymentsResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'x-client-id': process.env.CASHFREE_APP_ID!,
            'x-client-secret': process.env.CASHFREE_SECRET_KEY!,
            'x-api-version': '2023-08-01',
          },
        });

        const paymentsData = await paymentsResponse.json();
        
        if (!paymentsData || !Array.isArray(paymentsData) || paymentsData.length === 0) {
          console.error("❌ No payments found for order");
          return NextResponse.json({ received: true });
        }

        const payment = paymentsData[0];
        
        if (payment.payment_status !== "SUCCESS") {
          console.log("⏳ Payment not yet successful");
          return NextResponse.json({ received: true });
        }

        // Find the payment record
        const dbPayment = await prisma.payment.findFirst({
          where: {
            transactionId: orderId,
            status: "PENDING",
          },
        });

        if (!dbPayment) {
          console.error("❌ Payment record not found in database");
          return NextResponse.json({ received: true });
        }

        const metadata = dbPayment.metadata as { planId: string; cfOrderId?: string };
        const planId = metadata.planId;
        const userId = dbPayment.userId;

        // Update payment status
        await prisma.payment.update({
          where: { id: dbPayment.id },
          data: {
            status: "SUCCESS",
            metadata: {
              ...metadata,
              paymentId: payment.cf_payment_id,
              paymentMethod: payment.payment_group,
            },
          },
        });

        console.log("✅ Payment marked as SUCCESS");

        // Create or update subscription
        const existingSubscription = await prisma.subscription.findUnique({
          where: { userId: userId },
        });

        const plan = await prisma.plan.findUnique({
          where: { id: planId },
        });

        if (!plan) {
          console.error("❌ Plan not found");
          return NextResponse.json({ received: true });
        }

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

        console.log(`✅ Subscription activated for user ${userId}`);
      } catch (apiError) {
        console.error("💥 Error verifying payment with Cashfree:", apiError);
        return NextResponse.json(
          { error: "Payment verification failed" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("💥 Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
