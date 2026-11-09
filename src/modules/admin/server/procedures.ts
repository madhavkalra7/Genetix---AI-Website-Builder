import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma";
import { describeReset, getDailyLimits, getTodayUsage, nextResetAt, usableDailyCap, utcDay } from "@/lib/token-budget";

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

// ==================== BUILD OBSERVABILITY ====================

type AdminBuildEvent = { at: string; stage: string; detail?: string };

const MAX_ADMIN_EVENTS = 200;
const MAX_ADMIN_EVENT_DETAIL = 1000;

/** Defensive parse of the events JSON written by the build pipeline. */
function normalizeBuildEvents(raw: unknown): AdminBuildEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: AdminBuildEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { at, stage, detail } = item as Record<string, unknown>;
    if (typeof stage !== "string" || !stage) continue;
    const atString =
      typeof at === "string" ? at : typeof at === "number" ? new Date(at).toISOString() : "";
    events.push({
      at: atString,
      stage,
      ...(typeof detail === "string" && detail
        ? { detail: detail.length > MAX_ADMIN_EVENT_DETAIL ? detail.slice(0, MAX_ADMIN_EVENT_DETAIL - 1) + "…" : detail }
        : {}),
    });
  }
  return events.slice(-MAX_ADMIN_EVENTS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

const adminBuildsRouter = createTRPCRouter({
  // Today's OpenAI token usage per model group vs the daily cap (src/lib/token-budget.ts)
  dailyTokens: protectedProcedure.query(async ({ ctx }) => {
    await checkAdminAccess(ctx.auth.userId);
    const usage = await getTodayUsage();
    const limits = getDailyLimits();
    return {
      day: utcDay(),
      resetAt: nextResetAt().toISOString(),
      resetLabel: describeReset(),
      groups: (["small", "large"] as const).map((group) => ({
        group,
        used: usage[group]?.tokens ?? 0,
        requests: usage[group]?.requests ?? 0,
        limit: limits[group],
        cap: usableDailyCap(group),
      })),
    };
  }),

  // Recent builds, newest first, cursor-paginated by build id
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        status: z.enum(["running", "succeeded", "failed"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      await checkAdminAccess(ctx.auth.userId);

      const rows = await prisma.build.findMany({
        where: input.status ? { status: input.status } : undefined,
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;

      const userIds = [...new Set(page.map((b) => b.userId).filter((id): id is string => !!id))];
      const users = userIds.length
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
        : [];
      const emailById = new Map(users.map((u) => [u.id, u.email]));

      return {
        items: page.map((b) => ({
          id: b.id,
          projectId: b.projectId,
          isApp: b.isApp,
          userId: b.userId,
          userEmail: b.userId ? emailById.get(b.userId) ?? null : null,
          status: b.status,
          stage: b.stage,
          model: b.model,
          reasoningEffort: b.reasoningEffort,
          llmCalls: b.llmCalls,
          inputTokens: b.inputTokens,
          cachedTokens: b.cachedTokens,
          outputTokens: b.outputTokens,
          reasoningTokens: b.reasoningTokens,
          qaIssues: b.qaIssues,
          reviewSummary: b.reviewSummary,
          error: b.error,
          startedAt: b.startedAt,
          finishedAt: b.finishedAt,
          durationMs: b.finishedAt ? b.finishedAt.getTime() - b.startedAt.getTime() : null,
          events: normalizeBuildEvents(b.events),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      };
    }),

  // Aggregates over the last 1 / 7 / 30 days
  stats: protectedProcedure
    .input(z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7) }))
    .query(async ({ input, ctx }) => {
      await checkAdminAccess(ctx.auth.userId);

      const since = new Date(Date.now() - input.days * DAY_MS);
      const where = { startedAt: { gte: since } };

      const [agg, byStatus, durationRows, dailyRows, byUser] = await Promise.all([
        prisma.build.aggregate({
          where,
          _count: { _all: true },
          _sum: { inputTokens: true, cachedTokens: true, outputTokens: true, reasoningTokens: true, llmCalls: true },
          _avg: { inputTokens: true, cachedTokens: true, outputTokens: true, reasoningTokens: true, qaIssues: true, llmCalls: true },
        }),
        prisma.build.groupBy({ by: ["status"], where, _count: { _all: true } }),
        prisma.$queryRaw<{ avg_seconds: number | null }[]>(Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM ("finishedAt" - "startedAt")))::float8 AS avg_seconds
          FROM "Build"
          WHERE "startedAt" >= ${since} AND "finishedAt" IS NOT NULL AND "status" <> 'running'
        `),
        prisma.$queryRaw<{ day: Date; total: number; succeeded: number; failed: number }[]>(Prisma.sql`
          SELECT date_trunc('day', "startedAt") AS day,
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE "status" = 'succeeded')::int AS succeeded,
                 COUNT(*) FILTER (WHERE "status" = 'failed')::int AS failed
          FROM "Build"
          WHERE "startedAt" >= ${since}
          GROUP BY 1
          ORDER BY 1
        `),
        prisma.build.groupBy({
          by: ["userId"],
          where: { ...where, userId: { not: null } },
          _count: { _all: true },
          _sum: { inputTokens: true, cachedTokens: true, outputTokens: true, reasoningTokens: true },
        }),
      ]);

      const statusCount = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
      const succeeded = statusCount("succeeded");
      const failed = statusCount("failed");
      const running = statusCount("running");
      const finished = succeeded + failed;

      // Top users by total tokens (input + output; reasoning tokens are a subset of output)
      const ranked = byUser
        .map((u) => {
          const inputTokens = u._sum.inputTokens ?? 0;
          const outputTokens = u._sum.outputTokens ?? 0;
          return {
            userId: u.userId as string,
            builds: u._count._all,
            inputTokens,
            cachedTokens: u._sum.cachedTokens ?? 0,
            outputTokens,
            reasoningTokens: u._sum.reasoningTokens ?? 0,
            totalTokens: inputTokens + outputTokens,
          };
        })
        .sort((a, b) => b.totalTokens - a.totalTokens)
        .slice(0, 10);
      const topUserRows = ranked.length
        ? await prisma.user.findMany({ where: { id: { in: ranked.map((r) => r.userId) } }, select: { id: true, email: true } })
        : [];
      const emailById = new Map(topUserRows.map((u) => [u.id, u.email]));

      // One bucket per UTC day in the window, including days without builds
      const dailyByKey = new Map(dailyRows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r]));
      const perDay: { date: string; total: number; succeeded: number; failed: number }[] = [];
      const start = new Date(since);
      start.setUTCHours(0, 0, 0, 0);
      for (let t = start.getTime(); t <= Date.now(); t += DAY_MS) {
        const key = new Date(t).toISOString().slice(0, 10);
        const row = dailyByKey.get(key);
        perDay.push({
          date: key,
          total: Number(row?.total ?? 0),
          succeeded: Number(row?.succeeded ?? 0),
          failed: Number(row?.failed ?? 0),
        });
      }

      const avgSeconds = durationRows[0]?.avg_seconds;

      return {
        days: input.days,
        since,
        totalBuilds: agg._count._all,
        succeeded,
        failed,
        running,
        successRate: finished > 0 ? succeeded / finished : null,
        avgDurationMs: avgSeconds != null ? Math.round(Number(avgSeconds) * 1000) : null,
        tokens: {
          total: {
            input: agg._sum.inputTokens ?? 0,
            cached: agg._sum.cachedTokens ?? 0,
            output: agg._sum.outputTokens ?? 0,
            reasoning: agg._sum.reasoningTokens ?? 0,
          },
          avg: {
            input: Math.round(agg._avg.inputTokens ?? 0),
            cached: Math.round(agg._avg.cachedTokens ?? 0),
            output: Math.round(agg._avg.outputTokens ?? 0),
            reasoning: Math.round(agg._avg.reasoningTokens ?? 0),
          },
        },
        totalLlmCalls: agg._sum.llmCalls ?? 0,
        avgLlmCalls: agg._avg.llmCalls ?? 0,
        avgQaIssues: agg._avg.qaIssues ?? 0,
        topUsers: ranked.map((r) => ({ ...r, email: emailById.get(r.userId) ?? null })),
        perDay,
      };
    }),
});

export const adminRouter = createTRPCRouter({
  // Build pipeline observability (admin.builds.list / admin.builds.stats)
  builds: adminBuildsRouter,

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
