// Credits are charged when a build SUCCEEDS, not when it is requested.
//
// - Request time (tRPC procedures): only check affordability. Builds that are still pending
//   (USER messages waiting for a reply, < 30 min old) reserve their cost, so a user can't
//   queue more builds than they can pay for: available = limit − used − reserved.
// - Completion (Inngest pipeline): `commitBuildReply` saves the ASSISTANT reply and charges the
//   owner in ONE database transaction, after atomically claiming the Build row. A build the user
//   stopped (Build.status = "cancelled", or its request already answered by the stop notice)
//   is neither saved nor charged. Failures/errors are never charged, so nothing is refunded.
//
// Server-only: works by userId (no cookies), safe in background jobs.

import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { AIQUEST_LIMIT } from "@/lib/aiquest";
import { getPendingBuildMessages, replyTimestamp } from "@/lib/build-queue";

/** Credits per build: website prompt / quick edit = 1, mobile app = 5. */
export const BUILD_COST = { web: 1, app: 5 } as const;

/** Pending requests older than this no longer reserve credits (stuck/lost runs). */
export const PENDING_RESERVATION_WINDOW_MS = 30 * 60 * 1000;

const FREE_PLAN_LIMIT = 3;

type Db = Prisma.TransactionClient;

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

/** Builds this user has waiting (running or queued), and the credits they reserve. */
export async function getReservedCredits(userId: string, db: Db = prisma): Promise<{ builds: number; credits: number }> {
  const since = new Date(Date.now() - PENDING_RESERVATION_WINDOW_MS);
  const select = { role: true, type: true, createdAt: true, fragments: { select: { id: true } } } as const;
  const [web, app] = await Promise.all([
    db.message.findMany({
      where: { project: { userId }, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { ...select, projectId: true },
    }),
    db.appMessage.findMany({
      where: { appProject: { userId }, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { ...select, appProjectId: true },
    }),
  ]);
  const countPending = <T extends { role: string; type: string; fragments: unknown }>(rows: T[], key: (r: T) => string) => {
    const byProject = new Map<string, T[]>();
    for (const r of rows) {
      const list = byProject.get(key(r)) ?? [];
      list.push(r);
      byProject.set(key(r), list);
    }
    let n = 0;
    for (const list of byProject.values()) n += getPendingBuildMessages(list).length;
    return n;
  };
  const webPending = countPending(web, (r) => r.projectId);
  const appPending = countPending(app, (r) => r.appProjectId);
  return { builds: webPending + appPending, credits: webPending * BUILD_COST.web + appPending * BUILD_COST.app };
}

/** Balance after reservations. AIQuest users: iterations (1 per build), not credits. */
export async function getAvailableCredits(userId: string, db: Db = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { aiquestUserId: true, aiquestIterationsUsed: true } });
  if (!user) throw new Error("User not found");
  const reserved = await getReservedCredits(userId, db);
  if (user.aiquestUserId) {
    return {
      aiquestMode: true as const,
      used: user.aiquestIterationsUsed,
      limit: AIQUEST_LIMIT,
      reserved: reserved.builds,
      reservedBuilds: reserved.builds,
      available: AIQUEST_LIMIT - user.aiquestIterationsUsed - reserved.builds,
    };
  }
  const credits = await db.userCredits.upsert({
    where: { userId },
    update: {},
    create: { userId, creditsUsed: 0, creditsLimit: FREE_PLAN_LIMIT, lastReset: new Date() },
  });
  return {
    aiquestMode: false as const,
    used: credits.creditsUsed,
    limit: credits.creditsLimit,
    reserved: reserved.credits,
    reservedBuilds: reserved.builds,
    available: credits.creditsLimit - credits.creditsUsed - reserved.credits,
  };
}

/**
 * Request-time check (nothing is charged). Throws InsufficientCreditsError if the user can't
 * afford `cost` on top of the builds they already have running/queued.
 *
 * Call with the default `afterCreate: false` BEFORE creating the USER message, and again with
 * `afterCreate: true` right after (the new message now counts as reserved): this second check
 * catches parallel requests that both passed the first one. The caller must then delete what it
 * created.
 */
export async function assertCanAffordBuild(userId: string, cost: number, opts: { afterCreate?: boolean } = {}) {
  const balance = await getAvailableCredits(userId);
  const needed = balance.aiquestMode ? 1 : cost;
  const ok = opts.afterCreate ? balance.available >= 0 : balance.available >= needed;
  if (ok) return balance;
  if (balance.aiquestMode) {
    throw new InsufficientCreditsError(
      balance.reservedBuilds > (opts.afterCreate ? 1 : 0)
        ? "World 6 has reached its three-iteration limit (including builds still in progress). Wait for them to finish or stop them."
        : "World 6 has reached its three-iteration limit.",
    );
  }
  const others = balance.reservedBuilds - (opts.afterCreate ? 1 : 0);
  throw new InsufficientCreditsError(
    others > 0
      ? `Insufficient credits: ${others} build${others === 1 ? " is" : "s are"} still in progress and reserve your remaining credits. Wait for ${others === 1 ? "it" : "them"} to finish, stop ${others === 1 ? "it" : "them"}, or upgrade your plan.`
      : "Insufficient credits",
  );
}

/** tRPC flavour of assertCanAffordBuild: a shortfall becomes a BAD_REQUEST with the reason. */
export async function assertCanAffordBuildOrThrow(userId: string, cost: number, opts?: { afterCreate?: boolean }) {
  try {
    return await assertCanAffordBuild(userId, cost, opts);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
}

/** Charge a finished build. Idempotency comes from the caller (one transaction per reply). */
export async function chargeBuildCredits(userId: string, amount: number, db: Db = prisma): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { aiquestUserId: true } });
  if (!user) return;
  if (user.aiquestUserId) {
    // AIQuest (World 6) counts iterations, 1 per build. Reserved at request time, so no cap here.
    await db.user.update({ where: { id: userId }, data: { aiquestIterationsUsed: { increment: 1 } } });
    return;
  }
  if (amount <= 0) return;
  await db.userCredits.upsert({
    where: { userId },
    update: { creditsUsed: { increment: amount } },
    create: { userId, creditsUsed: amount, creditsLimit: FREE_PLAN_LIMIT, lastReset: new Date() },
  });
}

// ---------------------------------------------------------------------------------------------
// Pipeline side: which request a run answers, and saving its reply (+ charge) exactly once.

async function loadQueueMessages(db: Db, projectId: string, isApp: boolean) {
  const select = { id: true, role: true, type: true, createdAt: true, fragments: { select: { id: true } } } as const;
  return isApp
    ? db.appMessage.findMany({ where: { appProjectId: projectId }, orderBy: { createdAt: "asc" }, select })
    : db.message.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, select });
}

/**
 * The USER message a run answers and whether it is still waiting for a reply.
 * Without a messageId (events sent before this change) the oldest pending request is used.
 */
export async function resolveBuildRequest(
  db: Db,
  opts: { projectId: string; isApp: boolean; messageId?: string | null },
) {
  const messages = await loadQueueMessages(db, opts.projectId, opts.isApp);
  const pending = getPendingBuildMessages(messages);
  const request = opts.messageId ? messages.find((m) => m.id === opts.messageId) ?? null : pending[0] ?? null;
  const isPending = !!request && pending.some((m) => m.id === request.id);
  return { messages, pending, request, isPending };
}

/** True while the run's request hasn't been answered (e.g. by "Stopped") — checked at run start. */
export async function isBuildRequestPending(opts: { projectId: string; isApp: boolean; messageId?: string | null }) {
  return (await resolveBuildRequest(prisma, opts)).isPending;
}

/** Owner of a project / app project (used when the event carries no userId). */
export async function getBuildOwnerId(projectId: string, isApp: boolean, db: Db = prisma): Promise<string | null> {
  if (isApp) {
    const p = await db.appProject.findUnique({ where: { id: projectId }, select: { userId: true } });
    return p?.userId ?? null;
  }
  const p = await db.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  return p?.userId ?? null;
}

export type CommitResult =
  | { status: "saved"; charged: number }
  | { status: "cancelled" }   // the user stopped this build: nothing saved, nothing charged
  | { status: "answered" };   // request already has a reply (stop notice / retried step): no-op

/**
 * Save a build's ASSISTANT reply and, if it succeeded, charge the owner — atomically.
 * 1. Claims the Build row (running → succeeded/failed). If the user already marked it
 *    "cancelled", nothing happens.
 * 2. Skips if the request was already answered (stopped, or this step is being retried).
 * 3. Writes the reply right after its USER message (so queued requests stay "pending").
 * 4. Charges `creditCost` only when `outcome` is "succeeded".
 */
export async function commitBuildReply(opts: {
  projectId: string;
  isApp: boolean;
  messageId?: string | null;
  buildId?: string | null;
  ownerId?: string | null;
  creditCost: number;
  outcome: "succeeded" | "failed";
  write: (tx: Db, at: Date) => Promise<unknown>;
}): Promise<CommitResult> {
  return prisma.$transaction(
    async (tx) => {
      let claimed = false;
      if (opts.buildId) {
        const claim = await tx.build.updateMany({
          where: { id: opts.buildId, status: "running" },
          data: { status: opts.outcome },
        });
        claimed = claim.count === 1;
        if (!claimed) {
          const build = await tx.build.findUnique({ where: { id: opts.buildId }, select: { status: true } });
          if (build?.status === "cancelled") return { status: "cancelled" as const };
        }
      }

      const req = await resolveBuildRequest(tx, opts);
      if (opts.messageId ? !req.isPending : req.pending.length === 0) {
        // Answered by a stop notice while this run was still going: record it as cancelled
        // (a retried step finds the row already finished and leaves it alone).
        if (claimed) {
          await tx.build.update({
            where: { id: opts.buildId! },
            data: { status: "cancelled", stage: "failed", error: "Stopped by user", finishedAt: new Date() },
          });
          return { status: "cancelled" as const };
        }
        return { status: "answered" as const };
      }

      const at = req.request ? replyTimestamp(req.messages, req.request.id) : new Date();
      await opts.write(tx, at);

      if (opts.outcome !== "succeeded") return { status: "saved" as const, charged: 0 };
      const ownerId = opts.ownerId ?? (await getBuildOwnerId(opts.projectId, opts.isApp, tx));
      if (!ownerId) return { status: "saved" as const, charged: 0 };
      await chargeBuildCredits(ownerId, opts.creditCost, tx);
      return { status: "saved" as const, charged: opts.creditCost };
    },
    // Fragments can carry large files (base64 images)
    { maxWait: 10_000, timeout: 60_000 },
  );
}
