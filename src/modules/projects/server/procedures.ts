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
                    updatedAt: "asc",
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
                techStack: z.string().optional().default("react-nextjs")
            }),
        )
        .mutation(async ({ input,ctx })=> {

            console.log("🚀 Project create mutation called");
            console.log("User ID from context:", ctx.auth.userId);
            console.log("Input:", { value: input.value, techStack: input.techStack });

            try{
                console.log("Attempting to consume credits...");
                await consumeCredits();
                console.log("✅ Credits consumed successfully");
                } catch(error){
                    console.error("❌ Credit consumption failed:", error);
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

            if (!ctx.auth.userId) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                });
            }
            
            const createdProject= await prisma.project.create({
                data: {
                    userId: ctx.auth.userId,
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