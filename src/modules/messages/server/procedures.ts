import { prisma } from "@/lib/db";
import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { inngest } from "@/inngest/client";
import { TRPCError } from "@trpc/server";
import { BUILD_COST, assertCanAffordBuildOrThrow } from "@/lib/credits";
import { ensureDailyTokenBudget } from "@/lib/token-budget-guard";
import { getPendingBuildMessages, stoppedMessageText } from "@/lib/build-queue";
import { enforceBuildRateLimit } from "@/lib/rate-limit";
import { appendImageBrief, imagesInputSchema, resolveImageBrief, withImageMarker } from "@/lib/image-brief";
export const messagesRouter = createTRPCRouter({
    getMany: protectedProcedure
        .input(
            z.object({
                
                projectId: z.string().min(1, { message: "Project ID is required" }),
            }),
        )
        .query(async ({ input,ctx })=>{
            const messages= await prisma.message.findMany({
                where: {
                    projectId: input.projectId,
                    project:{
                        userId: ctx.auth.userId,
                    },
                },
                include: {
                    fragments: true,
                },
                orderBy: {
                    updatedAt: "asc",
                },
            });
            return messages;
        }),
    create:protectedProcedure
        .input(
            z.object({
                value:z.string()
                    .min(1, { message: "Message is required"})
                    .max(10000,{ message: "Message is too long"}),
                projectId: z.string().min(1, { message: "Project ID is required" }),
                // "quick": fast targeted edit (click-to-edit) — one focused AI call, no full pipeline
                mode: z.enum(["build", "quick"]).optional(),
                // Reference screenshots/sketches (data URLs); turned into a written brief, never stored
                images: imagesInputSchema,
            }),
        )
        .mutation(async ({ input,ctx })=> {
            const existingProject=await prisma.project.findUnique({
                where:{
                    id:input.projectId,
                    userId:ctx.auth.userId,
                },
            });

            if(!existingProject){
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Project not found",
                });
            }

            await enforceBuildRateLimit(ctx.auth.userId);

            // Credits are charged when the build succeeds (in the pipeline). Here we only check
            // that the user can afford it on top of builds still running/queued.
            await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.web);
            // Daily OpenAI token meter: pause new AI work until the 00:00 UTC reset when the key is out of free tokens
            await ensureDailyTokenBudget(input.mode === "quick" ? "quickEdit" : "build", {
                advanced: input.mode !== "quick" && existingProject.advancedReasoning,
            });

            const imageCount = input.images?.length ?? 0;
            const imageBrief = await resolveImageBrief(input.images, input.value);
            const createdMessage=await prisma.message.create({
                data: {
                    projectId: input.projectId,
                    content: withImageMarker(input.value, imageCount),
                    role: "USER",
                    type: "RESULT",
                },
            });
            try {
                // Re-check now that this request reserves credits (parallel requests can't overspend)
                await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.web, { afterCreate: true });
                // Quick edits only for static projects that already have a version to edit
                const STATIC_STACKS = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"];
                const canQuickEdit =
                    input.mode === "quick" &&
                    imageCount === 0 && // reference images need the full build pipeline
                    STATIC_STACKS.includes(existingProject.techStack) &&
                    !!(await prisma.fragment.findFirst({
                        where: { message: { projectId: input.projectId } },
                        select: { id: true },
                    }));
                // Runs for one project execute one at a time (Inngest concurrency): if a build is
                // running, this one waits in the queue and starts with its result + chat history.
                await inngest.send({
                    name: canQuickEdit ? "code-agent/quick-edit" : "code-agent/run",
                    data: {
                        value: appendImageBrief(input.value, imageBrief, imageCount),
                        projectId: input.projectId,
                        userId: ctx.auth.userId,
                        messageId: createdMessage.id,
                        creditCost: BUILD_COST.web,
                    },
                    });
                return createdMessage;
            } catch (error) {
                // The build never started: remove the request so it doesn't hang as "Building…"
                await prisma.message.delete({ where: { id: createdMessage.id } }).catch(() => {});
                throw error;
            }
        }),
    // ⏹ Stop: cancel the running build AND every queued request for this project (website or
    // app). Nothing is charged for stopped builds (credits are only charged on success).
    cancelBuild: protectedProcedure
        .input(z.object({ projectId: z.string().min(1), isApp: z.boolean().optional().default(false) }))
        .mutation(async ({ input, ctx }) => {
            const owned = input.isApp
                ? await prisma.appProject.findFirst({ where: { id: input.projectId, userId: ctx.auth.userId }, select: { id: true } })
                : await prisma.project.findFirst({ where: { id: input.projectId, userId: ctx.auth.userId }, select: { id: true } });
            if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

            // 1. Cancel the running run and every queued run for this project (cancelOn in both functions)
            await inngest.send({ name: "code-agent/cancel", data: { projectId: input.projectId, isApp: input.isApp } });

            // 2. Mark running Build rows cancelled. The pipeline's save step claims the row
            //    (running → succeeded) in the same transaction that saves + charges, so exactly one
            //    side wins: a build that already finished keeps its result (and its charge).
            const { count: stoppedBuilds } = await prisma.build.updateMany({
                where: { projectId: input.projectId, isApp: input.isApp, status: "running" },
                data: { status: "cancelled", stage: "failed", error: "Stopped by user", finishedAt: new Date() },
            });

            // 3. Answer every request still waiting with ONE notice (clears "Building…"/"Queued")
            const select = { id: true, role: true, type: true, fragments: { select: { id: true } } } as const;
            const messages = input.isApp
                ? await prisma.appMessage.findMany({ where: { appProjectId: input.projectId }, orderBy: { createdAt: "asc" }, select })
                : await prisma.message.findMany({ where: { projectId: input.projectId }, orderBy: { createdAt: "asc" }, select });
            const pending = getPendingBuildMessages(messages);
            if (pending.length > 0) {
                const data = { content: stoppedMessageText(pending.length), role: "ASSISTANT" as const, type: "ERROR" as const };
                if (input.isApp) await prisma.appMessage.create({ data: { ...data, appProjectId: input.projectId } });
                else await prisma.message.create({ data: { ...data, projectId: input.projectId } });
            }
            return { cancelledRequests: pending.length, stoppedBuilds };
        }),
    // ↩️ Revert: delete the latest version AND everything said since the previous version
    // (the prompt that produced it, plan chats, the reply + fragment), returning the project
    // to the previous version. No AI, no credits.
    revertLast: protectedProcedure
        .input(z.object({ projectId: z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
            const project = await prisma.project.findFirst({
                where: { id: input.projectId, userId: ctx.auth.userId },
                select: { id: true },
            });
            if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

            const versions = await prisma.message.findMany({
                where: { projectId: input.projectId, role: "ASSISTANT", fragments: { isNot: null } },
                orderBy: { createdAt: "desc" },
                take: 2,
                select: { id: true, createdAt: true, fragments: { select: { id: true } } },
            });
            if (versions.length < 2) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "This is the first version — there's nothing to revert to." });
            }

            // Don't pull the rug out from under a running build
            const last = await prisma.message.findFirst({
                where: { projectId: input.projectId },
                orderBy: { createdAt: "desc" },
                select: { role: true, createdAt: true },
            });
            const running = await prisma.build.findFirst({
                where: { projectId: input.projectId, isApp: false, status: "running", startedAt: { gte: new Date(Date.now() - 20 * 60 * 1000) } },
                select: { id: true },
            });
            if (running || (last?.role === "USER" && last.createdAt > versions[0].createdAt)) {
                throw new TRPCError({ code: "CONFLICT", message: "Please wait for the current build to finish before reverting." });
            }

            const previous = versions[1];
            const { count } = await prisma.$transaction(async (tx) => {
                const deleted = await tx.message.deleteMany({
                    where: { projectId: input.projectId, createdAt: { gt: previous.createdAt } },
                });
                await tx.project.update({ where: { id: input.projectId }, data: { updatedAt: new Date() } });
                return deleted;
            });
            return { deletedMessages: count, restoredFragmentId: previous.fragments?.id ?? null };
        }),
});
