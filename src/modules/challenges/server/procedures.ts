import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { LEADERBOARD_MAX, MAX_ENTRIES_PER_USER, isChallengeOpen } from "../shared";
import {
    ensureCurrentChallenge,
    getLeaderboard,
    serializeChallenge,
} from "./service";

const projectIdSchema = z.string().min(1, { message: "Project ID is required" });

async function requireOpenChallenge() {
    const challenge = await ensureCurrentChallenge();
    if (!isChallengeOpen(challenge)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "There's no open challenge right now" });
    }
    return challenge;
}

export const challengesRouter = createTRPCRouter({
    /** This week's challenge (created lazily), time left and number of entries. */
    current: baseProcedure.query(async () => {
        const challenge = await ensureCurrentChallenge();
        const entryCount = await prisma.challengeEntry.count({ where: { challengeId: challenge.id } });
        return { ...serializeChallenge(challenge), entryCount };
    }),

    leaderboard: baseProcedure
        .input(
            z.object({
                challengeId: z.string().min(1),
                limit: z.number().int().min(1).max(LEADERBOARD_MAX).default(20),
            })
        )
        .query(async ({ input }) => {
            const challenge = await prisma.challenge.findUnique({ where: { id: input.challengeId } });
            if (!challenge) throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found" });
            const board = await getLeaderboard(challenge, input.limit);
            return { challengeId: challenge.id, awarded: !!challenge.awardedAt, ...board };
        }),

    /** Previous challenges (most recent first) with their top 3. */
    past: baseProcedure
        .input(z.object({ limit: z.number().int().min(1).max(20).default(6) }).optional())
        .query(async ({ input }) => {
            const now = new Date();
            const challenges = await prisma.challenge.findMany({
                where: { endsAt: { lt: now } },
                orderBy: { endsAt: "desc" },
                take: input?.limit ?? 6,
            });
            return Promise.all(
                challenges.map(async (challenge) => {
                    const [board, entryCount] = await Promise.all([
                        getLeaderboard(challenge, 3),
                        prisma.challengeEntry.count({ where: { challengeId: challenge.id } }),
                    ]);
                    return { ...serializeChallenge(challenge, now), entryCount, top: board.items };
                })
            );
        }),

    /** The caller's entries across challenges (newest first). */
    myEntries: protectedProcedure.query(async ({ ctx }) => {
        const entries = await prisma.challengeEntry.findMany({
            where: { userId: ctx.auth.userId },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { challenge: { select: { id: true, slug: true, title: true, endsAt: true, awardedAt: true } } },
        });
        const [sites, projects] = await Promise.all([
            prisma.publishedSite.findMany({
                where: { projectId: { in: entries.map((e) => e.projectId) } },
                select: { projectId: true, slug: true, title: true },
            }),
            prisma.project.findMany({
                where: { id: { in: entries.map((e) => e.projectId) }, userId: ctx.auth.userId },
                select: { id: true, name: true },
            }),
        ]);
        const siteByProject = new Map(sites.map((s) => [s.projectId, s]));
        const projectById = new Map(projects.map((p) => [p.id, p]));
        return entries.map((e) => {
            const site = siteByProject.get(e.projectId);
            return {
                id: e.id,
                projectId: e.projectId,
                title: site?.title?.trim() || projectById.get(e.projectId)?.name || "Untitled",
                slug: site?.slug ?? null,
                rank: e.rank,
                submittedAt: e.createdAt,
                challenge: e.challenge,
            };
        });
    }),

    /** For the publish dialog: the open challenge and whether this project is entered. */
    projectStatus: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .query(async ({ input, ctx }) => {
            const challenge = await ensureCurrentChallenge();
            const [entry, userEntryCount] = await Promise.all([
                prisma.challengeEntry.findUnique({
                    where: { challengeId_projectId: { challengeId: challenge.id, projectId: input.projectId } },
                    select: { id: true, userId: true },
                }),
                prisma.challengeEntry.count({ where: { challengeId: challenge.id, userId: ctx.auth.userId } }),
            ]);
            return {
                challenge: serializeChallenge(challenge),
                submitted: !!entry && entry.userId === ctx.auth.userId,
                userEntryCount,
                maxEntries: MAX_ENTRIES_PER_USER,
            };
        }),

    submit: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .mutation(async ({ input, ctx }) => {
            const userId = ctx.auth.userId;
            const challenge = await requireOpenChallenge();

            const site = await prisma.publishedSite.findUnique({
                where: { projectId: input.projectId },
                select: { id: true, userId: true },
            });
            if (!site || site.userId !== userId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Publish this project first, then submit it to the challenge.",
                });
            }
            const project = await prisma.project.findFirst({
                where: { id: input.projectId, userId },
                select: { id: true },
            });
            if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

            try {
                const entry = await prisma.$transaction(
                    async (tx) => {
                        const existing = await tx.challengeEntry.findUnique({
                            where: { challengeId_projectId: { challengeId: challenge.id, projectId: project.id } },
                            select: { id: true },
                        });
                        if (existing) {
                            throw new TRPCError({ code: "CONFLICT", message: "This project is already entered." });
                        }
                        const count = await tx.challengeEntry.count({
                            where: { challengeId: challenge.id, userId },
                        });
                        if (count >= MAX_ENTRIES_PER_USER) {
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: `You can enter up to ${MAX_ENTRIES_PER_USER} projects per challenge. Withdraw one to submit another.`,
                            });
                        }
                        const created = await tx.challengeEntry.create({
                            data: { challengeId: challenge.id, projectId: project.id, siteId: site.id, userId },
                        });
                        // Entries are public: list the site in the community gallery too.
                        await tx.publishedSite.update({ where: { id: site.id }, data: { showcase: true } });
                        return created;
                    },
                    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
                );
                return { entryId: entry.id, challengeId: challenge.id, title: challenge.title };
            } catch (error) {
                if (error instanceof TRPCError) throw error;
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    if (error.code === "P2002") {
                        throw new TRPCError({ code: "CONFLICT", message: "This project is already entered." });
                    }
                    if (error.code === "P2034") {
                        throw new TRPCError({ code: "CONFLICT", message: "Please try again." });
                    }
                }
                throw error;
            }
        }),

    withdraw: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .mutation(async ({ input, ctx }) => {
            const challenge = await requireOpenChallenge();
            const { count } = await prisma.challengeEntry.deleteMany({
                where: { challengeId: challenge.id, projectId: input.projectId, userId: ctx.auth.userId },
            });
            if (count === 0) {
                throw new TRPCError({ code: "NOT_FOUND", message: "This project isn't entered in the challenge." });
            }
            return { withdrawn: true };
        }),
});

