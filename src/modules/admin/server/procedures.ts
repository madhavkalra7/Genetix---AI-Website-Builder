import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

// Utility to verify if current user has admin access
async function checkAdminAccess(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId }
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  
  if (!adminEmail || !dbUser || dbUser.email !== adminEmail) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin access required",
    });
  }
  return dbUser;
}

export const adminRouter = createTRPCRouter({
  // Verify admin access
  isAdmin: protectedProcedure.query(async ({ ctx }) => {
    try {
      await checkAdminAccess(ctx.auth.userId);
      return true;
    } catch {
      return false;
    }
  }),

  // Fetch all users with credits and subscription
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    await checkAdminAccess(ctx.auth.userId);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        credits: true,
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      createdAt: u.createdAt,
      creditsUsed: u.credits?.creditsUsed ?? 0,
      creditsLimit: u.credits?.creditsLimit ?? 3,
      planName: u.subscription?.plan?.name ?? "free",
      planId: u.subscription?.plan?.id ?? null
    }));
  }),

  // Create a new user with default credits
  createUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(6),
        creditsLimit: z.number().int().min(0).default(3)
      })
    )
    .mutation(async ({ input, ctx }) => {
      await checkAdminAccess(ctx.auth.userId);

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email }
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists"
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      // Create user and initialize credits
      const createdUser = await prisma.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          emailVerified: true,
          credits: {
            create: {
              creditsUsed: 0,
              creditsLimit: input.creditsLimit,
              lastReset: new Date()
            }
          }
        }
      });

      return { id: createdUser.id, email: createdUser.email };
    }),

  // Update a user's credit limits and usage
  updateCredits: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        creditsLimit: z.number().int().min(0),
        creditsUsed: z.number().int().min(0)
      })
    )
    .mutation(async ({ input, ctx }) => {
      await checkAdminAccess(ctx.auth.userId);

      const updatedCredits = await prisma.userCredits.upsert({
        where: { userId: input.userId },
        update: {
          creditsLimit: input.creditsLimit,
          creditsUsed: input.creditsUsed,
          updatedAt: new Date()
        },
        create: {
          userId: input.userId,
          creditsLimit: input.creditsLimit,
          creditsUsed: input.creditsUsed,
          lastReset: new Date()
        }
      });

      return updatedCredits;
    }),

  // Fetch all credit requests
  getCreditRequests: protectedProcedure.query(async ({ ctx }) => {
    await checkAdminAccess(ctx.auth.userId);

    const requests = await prisma.creditRequest.findMany({
      orderBy: { createdAt: "desc" }
    });

    return requests;
  }),

  // Approve a credit request
  approveRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      await checkAdminAccess(ctx.auth.userId);

      const request = await prisma.creditRequest.findUnique({
        where: { id: input.requestId }
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found"
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: request.email }
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User matching request email not found in database"
        });
      }

      // Determine credits to assign based on request planName
      const planCredits = request.planName.toLowerCase() === "enterprise" ? 1000 : 100;

      // Update user credits
      await prisma.userCredits.upsert({
        where: { userId: user.id },
        update: {
          creditsLimit: planCredits,
          creditsUsed: 0,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          creditsLimit: planCredits,
          creditsUsed: 0,
          lastReset: new Date()
        }
      });

      // Update plan details / subscription record
      let plan = await prisma.plan.findUnique({
        where: { name: request.planName.toLowerCase() }
      });

      if (!plan) {
        // Create mock plan if it doesn't exist
        plan = await prisma.plan.create({
          data: {
            name: request.planName.toLowerCase(),
            displayName: request.planName,
            price: request.planName.toLowerCase() === "enterprise" ? 699 : 99,
            interval: "MONTHLY",
            features: JSON.stringify([]),
            credits: planCredits
          }
        });
      }

      // Upsert subscription
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      // Update request status to APPROVED
      const updatedRequest = await prisma.creditRequest.update({
        where: { id: input.requestId },
        data: { status: "APPROVED" }
      });

      return updatedRequest;
    })
});
