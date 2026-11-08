import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";

// ~2MB of text per file is plenty for hand edits and keeps the JSON column sane
const MAX_FILE_CONTENT_LENGTH = 2 * 1024 * 1024;

const filePathSchema = z
    .string()
    .trim()
    .min(1, { message: "File path is required" })
    .max(300, { message: "File path is too long" })
    .refine((p) => !p.split(/[\/]/).includes(".."), {
        message: "File path must not contain '..'",
    })
    .refine((p) => !p.includes("\0"), { message: "Invalid file path" });

export const fragmentsRouter = createTRPCRouter({
    updateFile: protectedProcedure
        .input(
            z.object({
                fragmentId: z.string().min(1, { message: "Fragment ID is required" }),
                path: filePathSchema,
                content: z
                    .string()
                    .max(MAX_FILE_CONTENT_LENGTH, { message: "File is too large (max 2MB)" }),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            return prisma.$transaction(async (tx) => {
                // Ownership: Fragment -> Message -> Project.userId must be the caller
                const fragment = await tx.fragment.findFirst({
                    where: {
                        id: input.fragmentId,
                        message: { project: { userId: ctx.auth.userId } },
                    },
                    select: { id: true, files: true },
                });

                if (!fragment) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
                }

                const currentFiles =
                    fragment.files && typeof fragment.files === "object" && !Array.isArray(fragment.files)
                        ? (fragment.files as Record<string, unknown>)
                        : {};

                const files: Record<string, string> = {};
                for (const [key, value] of Object.entries(currentFiles)) {
                    if (typeof value === "string") files[key] = value;
                }
                files[input.path] = input.content;

                const updated = await tx.fragment.update({
                    where: { id: fragment.id },
                    data: { files: files as Prisma.InputJsonValue },
                });

                return updated;
            });
        }),
});
