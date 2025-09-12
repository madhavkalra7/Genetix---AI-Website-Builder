import { prisma } from "@/lib/db";
import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { inngest } from "@/inngest/client";
import { generateSlug} from "random-word-slugs";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";
export const projectsRouter = createTRPCRouter({
    getOne: protectedProcedure
    .input(z.object({
        id: z.string().min(1, { message: "Project ID is required" }),
    }))
        .query(async ({ input , ctx})=>{
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
            const projects= await prisma.project.findMany({
                where:{
                    userId:ctx.auth.userId,
                },
                orderBy: {
                    updatedAt: "asc",
                },
            });
            return projects;
        }),
    create: protectedProcedure
        .input(
            z.object({
                value: z.string()
                .min(1, { message: "Value is required"})
                .max(10000,{ message: "Value is too long"}),
                enhancedValue: z.string().optional(), // Enhanced prompt for AI
                techStack: z.string().optional().default("react-nextjs")
            }),
        )
        .mutation(async ({ input,ctx })=> {

            try{
                await consumeCredits();
                } catch(error){
                    if(error instanceof Error){
                        throw new TRPCError({
                            code:"BAD_REQUEST", message:"Something went wrong"
                        });
                    } else{
                        throw new TRPCError({
                            code:"TOO_MANY_REQUESTS", message:"You have ran out of credits"
                        });
                    }
                }

            const createdProject= await prisma.project.create({
                data: {
                    userId:ctx.auth.userId,
                    name: generateSlug(2, { format: "kebab" }),
                    techStack: input.techStack,
                    messages: {
                        create: {
                            content: input.value, // Save original prompt for display
                            role: "USER",
                            type: "RESULT",
                        }
                    }
                }
            });

            await inngest.send({
                name: "code-agent/run",
                data: {
                    value: input.enhancedValue || input.value, // Use enhanced prompt for AI
                    projectId: createdProject.id,
                },
                });
                return createdProject;
        }),
});