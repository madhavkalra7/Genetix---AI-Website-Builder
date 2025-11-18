import { prisma } from "@/lib/db";
import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { inngest } from "@/inngest/client";
import { generateSlug} from "random-word-slugs";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";

// Function to generate a meaningful 2-word project name from user prompt
function generateProjectName(prompt: string): string {
    // Remove common words
    const commonWords = [
        'create', 'build', 'make', 'design', 'develop', 'generate', 'a', 'an', 
        'the', 'my', 'new', 'modern', 'simple', 'basic', 'advanced', 'with', 
        'for', 'and', 'or', 'but', 'website', 'app', 'application', 'page'
    ];
    
    // Clean and tokenize
    const words = prompt
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
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
                techStack: z.string().optional().default("react-nextjs"),
                templateId: z.string().optional(), // Template ID if user selected a template
                advancedReasoning: z.boolean().optional().default(false) // GPT-5.1 flag
            }),
        )
        .mutation(async ({ input,ctx })=> {

            console.log("🚀 Project create mutation called");
            console.log("User ID from context:", ctx.auth.userId);
            console.log("Input:", { value: input.value, techStack: input.techStack, advancedReasoning: input.advancedReasoning });

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
            
            // If using advanced reasoning, check 24-hour limit
            if (input.advancedReasoning) {
                const usage = await prisma.advancedReasoningUsage.findUnique({
                    where: { userId: ctx.auth.userId }
                });
                
                if (usage) {
                    const now = new Date();
                    const timeSinceLastUse = now.getTime() - usage.lastUsedAt.getTime();
                    const hours24 = 24 * 60 * 60 * 1000;
                    
                    if (timeSinceLastUse < hours24) {
                        const hoursRemaining = Math.ceil((hours24 - timeSinceLastUse) / (60 * 60 * 1000));
                        throw new TRPCError({
                            code: "TOO_MANY_REQUESTS",
                            message: `Advanced Reasoning is limited to once per 24 hours. Available again in ${hoursRemaining} hours.`
                        });
                    }
                }
                
                // Update or create usage record
                await prisma.advancedReasoningUsage.upsert({
                    where: { userId: ctx.auth.userId },
                    update: { lastUsedAt: new Date() },
                    create: { userId: ctx.auth.userId, lastUsedAt: new Date() }
                });
            }
            
            // Generate meaningful project name from user prompt
            const projectName = generateProjectName(input.value);
            console.log("📝 Generated project name:", projectName);
            
            const createdProject= await prisma.project.create({
                data: {
                    userId: ctx.auth.userId,
                    name: projectName, // Use meaningful name instead of random slug
                    techStack: input.techStack,
                    advancedReasoning: input.advancedReasoning, // Store GPT-5.1 flag
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
                    templateId: input.templateId, // Pass template ID to inngest
                },
                });
                return createdProject;
        }),
});