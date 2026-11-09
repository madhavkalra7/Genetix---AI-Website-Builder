import { prisma } from "@/lib/db";
import { z } from "zod";
import { protectedProcedure, createTRPCRouter, baseProcedure } from "@/trpc/init";
import { inngest } from "@/inngest/client";
import { generateSlug} from "random-word-slugs";
import { TRPCError } from "@trpc/server";
import { BUILD_COST, assertCanAffordBuildOrThrow } from "@/lib/credits";
import { isAiquestUser } from '@/lib/aiquest';
import { getTemplateById } from '@/lib/templates';
import { generateProjectName, sanitizeProjectName } from '@/lib/project-naming';
import { enforceBuildRateLimit } from '@/lib/rate-limit';
import { enforcePlanRateLimit, generatePlanReply } from '@/modules/plan/server/plan-chat';
import { appendImageBrief, imagesInputSchema, resolveImageBrief, withImageMarker } from '@/lib/image-brief';
import { appendDesignTheme, styleDnaSchema } from '@/lib/style-dna';

export const projectsRouter = createTRPCRouter({
    // Rename (pencil edit). Owner only.
    rename: protectedProcedure
        .input(z.object({ id: z.string().min(1), name: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const name = sanitizeProjectName(input.name);
            if (!name) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Name must be 1-60 characters" });
            }
            const { count } = await prisma.project.updateMany({
                where: { id: input.id, userId: ctx.auth.userId },
                data: { name },
            });
            if (count !== 1) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }
            return prisma.project.findUniqueOrThrow({ where: { id: input.id } });
        }),
    getOne: protectedProcedure
    .input(z.object({
        id: z.string().min(1, { message: "Project ID is required" }),
    }))
        .query(async ({ input , ctx})=>{
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }
            const existingProject= await prisma.project.findUnique({
                where: {
                    id: input.id,
                    userId: ctx.auth.userId,
                },
            });
            if(!existingProject) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Project not found",
                });
            }
            return existingProject;
        }),
    getMany: protectedProcedure
        .query(async ({ ctx })=>{
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }
            
            console.log("📂 getMany called with userId:", ctx.auth.userId);
            
            const projects= await prisma.project.findMany({
                where:{
                    userId: ctx.auth.userId,
                },
                orderBy: {
                    updatedAt: "desc",
                },
            });
            
            console.log("📂 Found projects:", projects.length);
            console.log("Projects:", projects.map(p => ({ id: p.id, name: p.name, userId: p.userId })));
            
            return projects;
        }),
    create: protectedProcedure
        .input(
            z.object({
                value: z.string()
                .min(1, { message: "Value is required"})
                .max(10000,{ message: "Value is too long"}),
                enhancedValue: z.string().optional(), // Enhanced prompt for AI
                techStack: z.string().optional().default("react-nextjs"),
                templateId: z.string().optional(), // Template ID if user selected a template
                advancedReasoning: z.boolean().optional().default(false), // GPT-5.1 flag
                planOnly: z.boolean().optional(), // Plan with Genetix first: chat only, no build/credits
                images: imagesInputSchema, // Reference screenshots/sketches → written brief (never stored)
                themeId: z.string().max(64).optional(), // Preset id from src/lib/theme-presets (unknown ids ignored)
                styleDna: styleDnaSchema.optional(), // Validated Style DNA theme (wins over themeId)
            }),
        )
        .mutation(async ({ input,ctx })=> {
            const aiquestMode = await isAiquestUser(ctx.auth.userId);
            const techStack = aiquestMode ? 'html-css-js' : input.techStack;
            const advancedReasoning = aiquestMode ? false : input.advancedReasoning;

            console.log("🚀 Project create mutation called");
            console.log("User ID from context:", ctx.auth.userId);
            console.log("Input:", { value: input.value, techStack: input.techStack, advancedReasoning: input.advancedReasoning });

            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }

            // Per-user build rate limit, checked before any credit or advanced-reasoning claim.
            await enforceBuildRateLimit(ctx.auth.userId);

            // Plan-first: no credits, no advanced-reasoning claim, no build. Create the project with
            // the user's first message plus Genetix's first planning reply. The reply is generated
            // BEFORE the project is created so a failed OpenAI call never leaves a dangling project.
            if (input.planOnly) {
                if (aiquestMode) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Plan mode is unavailable in World 6." });
                }
                if (input.value.length > 4000) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Message is too long for planning (max 4000 characters)" });
                }
                await enforcePlanRateLimit(ctx.auth.userId);
                const planImageCount = input.images?.length ?? 0;
                const [projectName, reply] = await Promise.all([
                    generateProjectName(input.value, "web"),
                    // Theme + image brief go into the planning context; the chat stores only the user's text
                    resolveImageBrief(input.images, input.value).then((brief) =>
                        generatePlanReply({
                            history: [],
                            message: appendImageBrief(appendDesignTheme(input.value, input.themeId, input.styleDna), brief, planImageCount),
                            techStack,
                        }),
                    ),
                ]);
                const now = Date.now();
                return prisma.project.create({
                    data: {
                        userId: ctx.auth.userId,
                        name: projectName,
                        techStack,
                        advancedReasoning: false,
                        messages: {
                            create: [
                                { content: withImageMarker(input.value, planImageCount), role: "USER", type: "RESULT", createdAt: new Date(now), updatedAt: new Date(now) },
                                { content: reply, role: "ASSISTANT", type: "RESULT", createdAt: new Date(now + 1), updatedAt: new Date(now + 1) },
                            ],
                        },
                    },
                });
            }

            // Advanced reasoning 24-hour limit: checked BEFORE spending a credit, and claimed
            // atomically so parallel requests can't both pass.
            const hours24 = 24 * 60 * 60 * 1000;
            let claimedAdvancedReasoning = false;
            let previousAdvancedUse: Date | null = null;
            if (advancedReasoning) {
                const now = new Date();
                const existing = await prisma.advancedReasoningUsage.findUnique({
                    where: { userId: ctx.auth.userId },
                });
                previousAdvancedUse = existing?.lastUsedAt ?? null;
                if (existing) {
                    const { count } = await prisma.advancedReasoningUsage.updateMany({
                        where: { userId: ctx.auth.userId, lastUsedAt: { lt: new Date(now.getTime() - hours24) } },
                        data: { lastUsedAt: now },
                    });
                    claimedAdvancedReasoning = count === 1;
                } else {
                    try {
                        await prisma.advancedReasoningUsage.create({ data: { userId: ctx.auth.userId, lastUsedAt: now } });
                        claimedAdvancedReasoning = true;
                    } catch {
                        claimedAdvancedReasoning = false; // created concurrently by another request
                    }
                }
                if (!claimedAdvancedReasoning) {
                    const last = (await prisma.advancedReasoningUsage.findUnique({ where: { userId: ctx.auth.userId } }))?.lastUsedAt ?? now;
                    const hoursRemaining = Math.max(1, Math.ceil((hours24 - (now.getTime() - last.getTime())) / (60 * 60 * 1000)));
                    throw new TRPCError({
                        code: "TOO_MANY_REQUESTS",
                        message: `Advanced Reasoning is limited to once per 24 hours. Available again in ${hoursRemaining} hours.`
                    });
                }
            }

            // Credits are charged when the build succeeds (in the pipeline); here we only check
            // the user can afford it on top of builds still running/queued.
            try{
                await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.web);
                } catch(error){
                    console.error("❌ Credit check failed:", error);
                    // Give back the advanced-reasoning slot if the build can't be afforded
                    if (claimedAdvancedReasoning) {
                        if (previousAdvancedUse) {
                            await prisma.advancedReasoningUsage.update({ where: { userId: ctx.auth.userId }, data: { lastUsedAt: previousAdvancedUse } }).catch(() => {});
                        } else {
                            await prisma.advancedReasoningUsage.deleteMany({ where: { userId: ctx.auth.userId } }).catch(() => {});
                        }
                    }
                    if (error instanceof TRPCError) throw error;
                    if(error instanceof Error){
                        console.error("Error message:", error.message);
                        throw new TRPCError({
                            code:"BAD_REQUEST", message: error.message || "Something went wrong"
                        });
                    } else{
                        throw new TRPCError({
                            code:"TOO_MANY_REQUESTS", message:"You have ran out of credits"
                        });
                    }
                }
            
            // Image brief runs in parallel with naming; resolveImageBrief never rejects (null on failure)
            const imageCount = input.images?.length ?? 0;
            const imageBriefPromise = resolveImageBrief(input.images, input.value);

            // Generate meaningful project name from user prompt
            const projectName = await generateProjectName(input.value, "web");
            console.log("📝 Generated project name:", projectName);
            
            const createdProject= await prisma.project.create({
                data: {
                    userId: ctx.auth.userId,
                    name: projectName, // Use meaningful name instead of random slug
                    techStack,
                    advancedReasoning,
                    messages: {
                        create: {
                            content: withImageMarker(input.value, imageCount), // Save original prompt for display
                            role: "USER",
                            type: "RESULT",
                        }
                    }
                }
            });
            // If anything below fails, the build never starts: remove the project (nothing was charged).
            try {
                // Re-check now that this request reserves credits (parallel requests can't overspend)
                await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.web, { afterCreate: true });
                const firstMessage = await prisma.message.findFirst({
                    where: { projectId: createdProject.id, role: "USER" },
                    select: { id: true },
                });

                const template = aiquestMode && input.templateId ? getTemplateById(input.templateId) : null;
                const aiquestPrompt = `${template ? `${template.designPrompt}\n\n` : ''}${input.value}\n\nBuild with HTML, CSS, and JavaScript.`;
                const imageBrief = await imageBriefPromise;
                const buildPrompt = appendImageBrief(
                    appendDesignTheme(aiquestMode ? aiquestPrompt : input.enhancedValue || input.value, input.themeId, input.styleDna),
                    imageBrief,
                    imageCount,
                );
                await inngest.send({
                    name: "code-agent/run",
                    data: {
                        value: buildPrompt,
                        projectId: createdProject.id,
                        templateId: input.templateId, // Pass template ID to inngest
                        userId: ctx.auth.userId,
                        messageId: firstMessage?.id,
                        creditCost: BUILD_COST.web,
                    },
                    });
                return createdProject;
            } catch (error) {
                await prisma.project.delete({ where: { id: createdProject.id } }).catch(() => {});
                throw error;
            }
        }),
});

export const appProjectsRouter = createTRPCRouter({
    // Rename (pencil edit). Owner only.
    rename: protectedProcedure
        .input(z.object({ id: z.string().min(1), name: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const name = sanitizeProjectName(input.name);
            if (!name) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Name must be 1-60 characters" });
            }
            const { count } = await prisma.appProject.updateMany({
                where: { id: input.id, userId: ctx.auth.userId },
                data: { name },
            });
            if (count !== 1) {
                throw new TRPCError({ code: "NOT_FOUND", message: "App project not found" });
            }
            return prisma.appProject.findUniqueOrThrow({ where: { id: input.id } });
        }),
    getMany: protectedProcedure
        .query(async ({ ctx }) => {
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }
            return await prisma.appProject.findMany({
                where: { userId: ctx.auth.userId },
                orderBy: { updatedAt: "desc" },
            });
        }),
    getOne: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }
            const project = await prisma.appProject.findUnique({
                where: { id: input.id, userId: ctx.auth.userId },
            });
            if (!project) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "App project not found",
                });
            }
            return project;
        }),
    getMessages: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ input, ctx }) => {
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }
            return await prisma.appMessage.findMany({
                where: {
                    appProjectId: input.projectId,
                    appProject: { userId: ctx.auth.userId },
                },
                include: {
                    fragments: true,
                },
                orderBy: {
                    createdAt: "asc",
                },
            });
        }),
    create: protectedProcedure
        .input(
            z.object({
                value: z.string().min(1, { message: "Prompt is required" }).max(10000),
                enhancedValue: z.string().optional(),
                images: imagesInputSchema,
                themeId: z.string().max(64).optional(),
                styleDna: styleDnaSchema.optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            if (await isAiquestUser(ctx.auth.userId)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Create App is unavailable in World 6.' });
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }

            await enforceBuildRateLimit(ctx.auth.userId);

            // Charged on success by the pipeline; here we only check affordability.
            await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.app);

            const imageCount = input.images?.length ?? 0;
            const imageBriefPromise = resolveImageBrief(input.images, input.value); // never rejects

            const projectName = await generateProjectName(input.value, "app");

            const createdProject = await prisma.appProject.create({
                data: {
                    userId: ctx.auth.userId,
                    name: projectName,
                    messages: {
                        create: {
                            content: withImageMarker(input.value, imageCount),
                            role: "USER",
                            type: "RESULT",
                        },
                    },
                },
            });
            // If anything below fails, the build never starts: remove the project (nothing was charged).
            try {
                // Re-check now that this request reserves credits (parallel requests can't overspend)
                await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.app, { afterCreate: true });
                const firstMessage = await prisma.appMessage.findFirst({
                    where: { appProjectId: createdProject.id, role: "USER" },
                    select: { id: true },
                });

                const imageBrief = await imageBriefPromise;
                await inngest.send({
                    name: "code-agent/run",
                    data: {
                        value: appendImageBrief(appendDesignTheme(input.enhancedValue || input.value, input.themeId, input.styleDna), imageBrief, imageCount),
                        projectId: createdProject.id,
                        isApp: true,
                        userId: ctx.auth.userId,
                        messageId: firstMessage?.id,
                        creditCost: BUILD_COST.app,
                    },
                });

                return createdProject;
            } catch (error) {
                await prisma.appProject.delete({ where: { id: createdProject.id } }).catch(() => {});
                throw error;
            }
        }),
    createMessage: protectedProcedure
        .input(
            z.object({
                projectId: z.string().min(1),
                value: z.string().min(1).max(10000),
                enhancedValue: z.string().optional(),
                images: imagesInputSchema,
                themeId: z.string().max(64).optional(),
                styleDna: styleDnaSchema.optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            if (await isAiquestUser(ctx.auth.userId)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Create App is unavailable in World 6.' });
            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }

            const existingProject = await prisma.appProject.findFirst({
                where: {
                    id: input.projectId,
                    userId: ctx.auth.userId,
                },
            });

            if (!existingProject) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "App project not found",
                });
            }

            await enforceBuildRateLimit(ctx.auth.userId);

            // Charged on success by the pipeline; here we only check affordability.
            await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.app);

            const imageCount = input.images?.length ?? 0;
            const imageBrief = await resolveImageBrief(input.images, input.value); // null on failure
            const createdMessage = await prisma.appMessage.create({
                data: {
                    appProjectId: input.projectId,
                    content: withImageMarker(input.value, imageCount),
                    role: "USER",
                    type: "RESULT",
                },
            });
            // If anything below fails, the build never starts: remove the request (nothing was charged).
            try {
                // Re-check now that this request reserves credits (parallel requests can't overspend)
                await assertCanAffordBuildOrThrow(ctx.auth.userId, BUILD_COST.app, { afterCreate: true });

                // Touch project updatedAt
                await prisma.appProject.update({
                    where: { id: input.projectId },
                    data: { updatedAt: new Date() },
                });

                await inngest.send({
                    name: "code-agent/run",
                    data: {
                        value: appendImageBrief(appendDesignTheme(input.enhancedValue || input.value, input.themeId, input.styleDna), imageBrief, imageCount),
                        projectId: input.projectId,
                        isApp: true,
                        userId: ctx.auth.userId,
                        messageId: createdMessage.id,
                        creditCost: BUILD_COST.app,
                    },
                });

                return createdMessage;
            } catch (error) {
                await prisma.appMessage.delete({ where: { id: createdMessage.id } }).catch(() => {});
                throw error;
            }
        }),
    getPublicPreview: baseProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ input }) => {
            const latestFragment = await prisma.appFragment.findFirst({
                where: { appMessage: { appProjectId: input.projectId } },
                orderBy: { createdAt: "desc" },
                select: { files: true }
            });
            if (!latestFragment) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Preview files not found",
                });
            }
            return latestFragment.files as { [path: string]: string };
        }),
});
