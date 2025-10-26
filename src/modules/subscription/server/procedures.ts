import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";

export const subscriptionRouter = createTRPCRouter({
  // Get current user's subscription
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    return subscription;
  }),

  // Get user's payment history
  getMyPayments: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return payments;
  }),

  // Check if user has active subscription
  hasActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: {
          gte: new Date(),
        },
      },
    });

    return !!subscription;
  }),
});
