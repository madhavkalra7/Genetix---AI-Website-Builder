import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { SHARE_REMIX_RATE_LIMIT, SHARE_REMIX_TITLE_MAX_LENGTH } from "@/modules/share/shared";
import {
    generateShareId,
    getLatestFragment,
    getShareUrl,
    getSharedProjectSummary,
    getSharedProjectView,
} from "@/modules/share/server/utils";

const MAX_ID_ATTEMPTS = 5;

const truncate = (value: string, max: number) =>
    value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

const shareIdInput = z.object({ shareId: z.string().trim().min(1).max(64) });

async function getOwnedProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, userId: true, shareId: true, shareEnabled: true },
    });
    if (!project || project.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    return project;
}

const toShareState = (project: { shareId: string | null; shareEnabled: boolean }) => ({
    enabled: project.shareEnabled && !!project.shareId,
    shareId: project.shareId,
    url: project.shareId ? getShareUrl(project.shareId) : null,
});

export const shareRouter = createTRPCRouter({
    get: protectedProcedure
        .input(z.object({ projectId: z.string().min(1) }))
        .query(async ({ input, ctx }) => {
            const project = await getOwnedProject(input.projectId, ctx.auth.userId);
            return toShareState(project);
        }),

    setEnabled: protectedProcedure
        .input(z.object({ projectId: z.string().min(1), enabled: z.boolean() }))
        .mutation(async ({ input, ctx }) => {
            const project = await getOwnedProject(input.projectId, ctx.auth.userId);

            // Disabling keeps the id so re-enabling restores the same link; the page just 404s meanwhile.
            if (!input.enabled || project.shareId) {
                const updated = await prisma.project.update({
                    where: { id: project.id },
                    data: { shareEnabled: input.enabled },
                    select: { shareId: true, shareEnabled: true },
                });
                return toShareState(updated);
            }

            // First enable: mint a unique id, retrying on the (very unlikely) unique-constraint collision.
            for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
                try {
                    const updated = await prisma.project.update({
                        where: { id: project.id },
                        data: { shareId: generateShareId(), shareEnabled: true },
                        select: { shareId: true, shareEnabled: true },
                    });
                    return toShareState(updated);
                } catch (error) {
                    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
                    throw error;
                }
            }
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not create a share link — please try again.",
            });
        }),

    view: baseProcedure.input(shareIdInput).query(async ({ input }) => {
        const view = await getSharedProjectView(input.shareId);
        if (!view) {
            throw new TRPCError({ code: "NOT_FOUND", message: "This share link doesn't exist or was turned off" });
        }
        return {
            projectName: view.projectName,
            techStack: view.techStack,
            author: view.author,
            files: view.files,
            versionTitle: view.versionTitle,
            updatedAt: view.updatedAt,
        };
    }),

    remix: protectedProcedure.input(shareIdInput).mutation(async ({ input, ctx }) => {
        const userId = ctx.auth.userId;

        const summary = await getSharedProjectSummary(input.shareId);
        if (!summary) {
            throw new TRPCError({ code: "NOT_FOUND", message: "This share link doesn't exist or was turned off" });
        }
        const fragment = await getLatestFragment(summary.projectId);
        if (!fragment) {
            throw new TRPCError({ code: "NOT_FOUND", message: "This project has no version to remix yet" });
        }

        const rate = await checkRateLimit(
            `remix:${userId}`,
            SHARE_REMIX_RATE_LIMIT.limit,
            SHARE_REMIX_RATE_LIMIT.windowMs
        );
        if (!rate.ok) {
            const minutes = Math.max(1, Math.ceil(rate.retryAfterSec / 60));
            throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: `You've remixed a lot recently — try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
            });
        }

        const title = summary.projectName;
        const now = Date.now();

        const created = await prisma.project.create({
            data: {
                userId,
                name: truncate(`Remix of ${title}`, SHARE_REMIX_TITLE_MAX_LENGTH),
                techStack: summary.techStack,
                messages: {
                    create: [
                        {
                            role: "USER",
                            type: "RESULT",
                            content: `Remixed from ${title}`,
                            createdAt: new Date(now),
                            updatedAt: new Date(now),
                        },
                        {
                            role: "ASSISTANT",
                            type: "RESULT",
                            content: `Here's your copy of ${title} — ask me to change anything.`,
                            createdAt: new Date(now + 1),
                            updatedAt: new Date(now + 1),
                            fragments: {
                                create: {
                                    title: fragment.title,
                                    sandboxUrl: fragment.sandboxUrl,
                                    files: (fragment.files ?? {}) as Prisma.InputJsonValue,
                                },
                            },
                        },
                    ],
                },
            },
            select: { id: true },
        });

        return { projectId: created.id };
    }),
});
