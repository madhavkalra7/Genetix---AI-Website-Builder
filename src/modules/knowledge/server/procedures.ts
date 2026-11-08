import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { KNOWLEDGE_MAX_LENGTH } from "@/modules/knowledge/shared";

const knowledgeSchema = z
    .string()
    .trim()
    .max(KNOWLEDGE_MAX_LENGTH, { message: `Knowledge can be at most ${KNOWLEDGE_MAX_LENGTH} characters` });

const projectIdSchema = z.string().min(1, { message: "Project ID is required" });

/** Empty (after trimming) knowledge is stored as null. */
const normalize = (value: string): string | null => (value.length > 0 ? value : null);

async function assertOwnedProject(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true, knowledge: true },
    });
    if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    return project;
}

export const knowledgeRouter = createTRPCRouter({
    getProject: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .query(async ({ input, ctx }) => {
            const project = await assertOwnedProject(input.projectId, ctx.auth.userId);
            return { knowledge: project.knowledge ?? "" };
        }),

    setProject: protectedProcedure
        .input(z.object({ projectId: projectIdSchema, knowledge: knowledgeSchema }))
        .mutation(async ({ input, ctx }) => {
            await assertOwnedProject(input.projectId, ctx.auth.userId);
            const knowledge = normalize(input.knowledge);
            await prisma.project.update({
                where: { id: input.projectId },
                data: { knowledge },
            });
            return { knowledge: knowledge ?? "" };
        }),

    getWorkspace: protectedProcedure.query(async ({ ctx }) => {
        const user = await prisma.user.findUnique({
            where: { id: ctx.auth.userId },
            select: { knowledge: true },
        });
        if (!user) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        return { knowledge: user.knowledge ?? "" };
    }),

    setWorkspace: protectedProcedure
        .input(z.object({ knowledge: knowledgeSchema }))
        .mutation(async ({ input, ctx }) => {
            const knowledge = normalize(input.knowledge);
            const { count } = await prisma.user.updateMany({
                where: { id: ctx.auth.userId },
                data: { knowledge },
            });
            if (count === 0) {
                throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
            }
            return { knowledge: knowledge ?? "" };
        }),
});
