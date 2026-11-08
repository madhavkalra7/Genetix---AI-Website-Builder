import { prisma } from "@/lib/db";
import { z } from "zod";
import { protectedProcedure, createTRPCRouter, baseProcedure } from "@/trpc/init";
import { inngest } from "@/inngest/client";
import { generateSlug} from "random-word-slugs";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";
import { refundCredit } from "@/lib/credit-refund";
import { isAiquestUser } from '@/lib/aiquest';
import { getTemplateById } from '@/lib/templates';

// Placeholder 2-word project name from the user prompt (shown while the first build runs).
// After the first successful build, the Inngest function replaces it with an AI-generated title.
function generateProjectName(prompt: string): string {
    // Instruction phrases that describe HOW to build, not WHAT to build
    const cleanedPrompt = prompt
        .toLowerCase()
        .replace(/\b(use|using|with|via|do|perform)\s+(a\s+)?(web|internet|google|online)\s+search(es|ing)?\b/g, ' ')
        .replace(/\b(search|look up|research)\s+(the\s+)?(web|internet|online)\b/g, ' ');

    // Remove common / filler words
    const commonWords = [
        'create', 'build', 'make', 'design', 'develop', 'generate', 'a', 'an',
        'the', 'my', 'new', 'modern', 'simple', 'basic', 'advanced', 'with',
        'for', 'and', 'or', 'but', 'website', 'app', 'application', 'page',
        'use', 'using', 'web', 'search', 'please', 'want', 'need', 'can', 'you',
        'could', 'would', 'should', 'like', 'some', 'that', 'this', 'just', 'also',
        'real', 'proper', 'good', 'best', 'nice', 'cool', 'beautiful', 'awesome',
        'give', 'help', 'write', 'code', 'fully', 'functional', 'responsive', 'are',
        'its', 'into', 'from', 'all', 'very', 'then', 'which', 'one', 'have', 'has',
    ];

    // Clean and tokenize
    const words = cleanedPrompt
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ') // Remove punctuation (keep non-English letters + vowel signs)
        .split(/\s+/)
        .filter(word => word.length > 2 && !commonWords.includes(word));
    
    // Take first 2 meaningful words
    if (words.length === 0) return 'Web Project';
    if (words.length === 1) return `${capitalize(words[0])} Site`;
    
    // Return first 2 words in title case
    return `${capitalize(words[0])} ${capitalize(words[1])}`;
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export const projectsRouter = createTRPCRouter({
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
                advancedReasoning: z.boolean().optional().default(false) // GPT-5.1 flag
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

            try{
                console.log("Attempting to consume credits...");
                await consumeCredits();
                console.log("✅ Credits consumed successfully");
                } catch(error){
                    console.error("❌ Credit consumption failed:", error);
                    // Give back the advanced-reasoning slot if no credit could be spent
                    if (claimedAdvancedReasoning) {
                        if (previousAdvancedUse) {
                            await prisma.advancedReasoningUsage.update({ where: { userId: ctx.auth.userId }, data: { lastUsedAt: previousAdvancedUse } }).catch(() => {});
                        } else {
                            await prisma.advancedReasoningUsage.deleteMany({ where: { userId: ctx.auth.userId } }).catch(() => {});
                        }
                    }
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
            
            // Generate meaningful project name from user prompt
            const projectName = generateProjectName(input.value);
            console.log("📝 Generated project name:", projectName);
            
            // If anything below fails, the build never starts: give the credit back.
            try {
                const createdProject= await prisma.project.create({
                    data: {
                        userId: ctx.auth.userId,
                        name: projectName, // Use meaningful name instead of random slug
                        techStack,
                        advancedReasoning,
                        messages: {
                            create: {
                                content: input.value, // Save original prompt for display
                                role: "USER",
                                type: "RESULT",
                            }
                        }
                    }
                });

                const template = aiquestMode && input.templateId ? getTemplateById(input.templateId) : null;
                const aiquestPrompt = `${template ? `${template.designPrompt}\n\n` : ''}${input.value}\n\nBuild with HTML, CSS, and JavaScript.`;
                await inngest.send({
                    name: "code-agent/run",
                    data: {
                        value: aiquestMode ? aiquestPrompt : input.enhancedValue || input.value,
                        projectId: createdProject.id,
                        templateId: input.templateId, // Pass template ID to inngest
                        creditCost: 1,
                    },
                    });
                return createdProject;
            } catch (error) {
                await refundCredit(ctx.auth.userId, 1).catch(() => {});
                throw error;
            }
        }),
});

export const appProjectsRouter = createTRPCRouter({
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

            try {
                await consumeCredits(5);
            } catch (error) {
                if (error instanceof Error) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: error.message || "Something went wrong",
                    });
                } else {
                    throw new TRPCError({
                        code: "TOO_MANY_REQUESTS",
                        message: "You have run out of credits",
                    });
                }
            }

            const projectName = generateProjectName(input.value);

            try {
                const createdProject = await prisma.appProject.create({
                    data: {
                        userId: ctx.auth.userId,
                        name: projectName,
                        messages: {
                            create: {
                                content: input.value,
                                role: "USER",
                                type: "RESULT",
                            },
                        },
                    },
                });

                await inngest.send({
                    name: "code-agent/run",
                    data: {
                        value: input.enhancedValue || input.value,
                        projectId: createdProject.id,
                        isApp: true,
                        creditCost: 5,
                    },
                });

                return createdProject;
            } catch (error) {
                await refundCredit(ctx.auth.userId, 5).catch(() => {});
                throw error;
            }
        }),
    createMessage: protectedProcedure
        .input(
            z.object({
                projectId: z.string().min(1),
                value: z.string().min(1).max(10000),
                enhancedValue: z.string().optional(),
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

            try {
                await consumeCredits(5);
            } catch (error) {
                if (error instanceof Error) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: error.message || "Something went wrong",
                    });
                } else {
                    throw new TRPCError({
                        code: "TOO_MANY_REQUESTS",
                        message: "You have run out of credits",
                    });
                }
            }

            try {
                const createdMessage = await prisma.appMessage.create({
                    data: {
                        appProjectId: input.projectId,
                        content: input.value,
                        role: "USER",
                        type: "RESULT",
                    },
                });

                // Touch project updatedAt
                await prisma.appProject.update({
                    where: { id: input.projectId },
                    data: { updatedAt: new Date() },
                });

                await inngest.send({
                    name: "code-agent/run",
                    data: {
                        value: input.enhancedValue || input.value,
                        projectId: input.projectId,
                        isApp: true,
                        creditCost: 5,
                    },
                });

                return createdMessage;
            } catch (error) {
                await refundCredit(ctx.auth.userId, 5).catch(() => {});
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
