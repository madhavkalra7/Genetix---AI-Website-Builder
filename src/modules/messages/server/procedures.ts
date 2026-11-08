import { prisma } from "@/lib/db";
import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { inngest } from "@/inngest/client";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";
import { refundCredit } from "@/lib/credit-refund";
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

            try{
                await consumeCredits();
            } catch(error){
                if(error instanceof Error){
                    throw new TRPCError({
                        code:"BAD_REQUEST", message:error.message
                    });
                } else{
                    throw new TRPCError({
                        code:"TOO_MANY_REQUESTS", message:"You have ran out of credits"
                    });
                }
            }
            // If anything below fails, the build never starts: give the credit back.
            try {
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
                await inngest.send({
                    name: canQuickEdit ? "code-agent/quick-edit" : "code-agent/run",
                    data: {
                        value: appendImageBrief(input.value, imageBrief, imageCount),
                        projectId: input.projectId,
                        creditCost: 1,
                    },
                    });
                return createdMessage;
            } catch (error) {
                await refundCredit(ctx.auth.userId).catch(() => {});
                throw error;
            }
        }),
});
