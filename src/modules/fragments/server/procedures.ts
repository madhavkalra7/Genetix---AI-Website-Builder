import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { unifiedDiff } from "@/lib/text-diff";

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

const MAX_TITLE_LENGTH = 60;
const MAX_PROJECT_NAME_LENGTH = 60;
// A build older than this is considered dead (crashed run that never finished)
const BUILD_STALE_MS = 20 * 60 * 1000;

const truncate = (text: string, max: number) =>
    text.length <= max ? text : text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";

const asFileMap = (files: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!files || typeof files !== "object" || Array.isArray(files)) return out;
    for (const [key, value] of Object.entries(files as Record<string, unknown>)) {
        if (typeof value === "string") out[key] = value;
    }
    return out;
};

const isDataUrl = (content: string) => /^data:[^,]{0,200},/i.test(content.slice(0, 220));

/**
 * True while a code-agent run is in flight for this (website) project: either a Build row
 * is still "running" or the last message is a USER message waiting for its reply.
 * Inserting an ASSISTANT message then would make the chat look finished mid-build.
 */
async function isProjectBuilding(projectId: string): Promise<boolean> {
    const since = new Date(Date.now() - BUILD_STALE_MS);
    const [running, last] = await Promise.all([
        prisma.build.findFirst({
            where: { projectId, isApp: false, status: "running", startedAt: { gte: since } },
            select: { id: true },
        }),
        prisma.message.findFirst({
            where: { projectId },
            orderBy: { updatedAt: "desc" },
            select: { role: true, createdAt: true },
        }),
    ]);
    if (running) return true;
    return !!last && last.role === "USER" && last.createdAt >= since;
}

export type FileChange = {
    path: string;
    status: "added" | "removed" | "modified" | "unchanged";
    /** Unified diff lines (" ", "-", "+" prefixed; "@@" hunk headers). Absent when too large/binary. */
    diff?: string[];
    /** Why no line diff is provided for a changed file */
    note?: string;
};

export const fragmentsRouter = createTRPCRouter({
    // Files of one fragment, for the full-screen preview page (owner only)
    getFiles: protectedProcedure
        .input(z.object({ fragmentId: z.string().min(1) }))
        .query(async ({ input, ctx }) => {
            const fragment = await prisma.fragment.findFirst({
                where: {
                    id: input.fragmentId,
                    message: { project: { userId: ctx.auth.userId } },
                },
                select: { files: true, title: true },
            });
            if (!fragment || !fragment.files || typeof fragment.files !== "object") {
                throw new TRPCError({ code: "NOT_FOUND", message: "Preview not found" });
            }
            return { title: fragment.title, files: fragment.files as Record<string, string> };
        }),

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
                    select: { id: true },
                });

                if (!fragment) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
                }

                // Atomic single-key update inside the jsonb column: two concurrent saves to
                // different files can no longer overwrite each other (no read-modify-write).
                // updatedAt is stored as UTC "timestamp without time zone" by Prisma.
                await tx.$executeRaw`
                    UPDATE "Fragment"
                    SET "files" = jsonb_set(
                            CASE WHEN jsonb_typeof("files") = 'object' THEN "files" ELSE '{}'::jsonb END,
                            ARRAY[${input.path}]::text[],
                            to_jsonb(${input.content}::text),
                            true
                        ),
                        "updatedAt" = (NOW() AT TIME ZONE 'UTC')
                    WHERE "id" = ${fragment.id}`;

                const updated = await tx.fragment.findUnique({ where: { id: fragment.id } });
                if (!updated) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
                }
                return updated;
            });
        }),

    // Restore an older version as the newest one (no credits; no AI run)
    restore: protectedProcedure
        .input(z.object({ fragmentId: z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
            const source = await prisma.fragment.findFirst({
                where: {
                    id: input.fragmentId,
                    message: { project: { userId: ctx.auth.userId } },
                },
                select: {
                    files: true,
                    title: true,
                    sandboxUrl: true,
                    message: { select: { projectId: true } },
                },
            });
            if (!source) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
            }
            const projectId = source.message.projectId;

            if (await isProjectBuilding(projectId)) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Please wait for the current build to finish before restoring a version",
                });
            }

            const baseTitle = source.title.replace(/^Restored:\s*/i, "");
            const title = truncate(`Restored: ${baseTitle}`, MAX_TITLE_LENGTH);

            return prisma.$transaction(async (tx) => {
                const message = await tx.message.create({
                    data: {
                        projectId,
                        role: "ASSISTANT",
                        type: "RESULT",
                        content: `Restored version "${source.title}"`,
                        fragments: {
                            create: {
                                title,
                                sandboxUrl: source.sandboxUrl,
                                files: (source.files ?? {}) as Prisma.InputJsonValue,
                            },
                        },
                    },
                    include: { fragments: true },
                });
                await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
                if (!message.fragments) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not restore this version" });
                }
                return message.fragments;
            });
        }),

    // Copy a project (its latest version) into a brand new project
    duplicateProject: protectedProcedure
        .input(z.object({ projectId: z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
            const project = await prisma.project.findFirst({
                where: { id: input.projectId, userId: ctx.auth.userId },
                select: { id: true, name: true, techStack: true, supabaseUrl: true, supabaseAnonKey: true },
            });
            if (!project) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }

            const latest = await prisma.fragment.findFirst({
                where: { message: { projectId: project.id, role: "ASSISTANT", type: "RESULT" } },
                orderBy: { createdAt: "desc" },
                select: { files: true, title: true, sandboxUrl: true },
            });
            if (!latest) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "This project has no version to duplicate yet" });
            }

            const suffix = " (copy)";
            const name = truncate(project.name, MAX_PROJECT_NAME_LENGTH - suffix.length) + suffix;

            const created = await prisma.$transaction(async (tx) => {
                const newProject = await tx.project.create({
                    data: {
                        name,
                        userId: ctx.auth.userId,
                        techStack: project.techStack,
                        advancedReasoning: false,
                        supabaseUrl: project.supabaseUrl,
                        supabaseAnonKey: project.supabaseAnonKey,
                    },
                    select: { id: true },
                });
                // Explicit, strictly increasing timestamps: the chat is ordered by updatedAt
                const now = Date.now();
                await tx.message.create({
                    data: {
                        projectId: newProject.id,
                        role: "USER",
                        type: "RESULT",
                        content: `Duplicated from ${project.name}`,
                        createdAt: new Date(now),
                        updatedAt: new Date(now),
                    },
                });
                await tx.message.create({
                    data: {
                        projectId: newProject.id,
                        role: "ASSISTANT",
                        type: "RESULT",
                        content: `Copied the latest version "${latest.title}"`,
                        createdAt: new Date(now + 1),
                        updatedAt: new Date(now + 1),
                        fragments: {
                            create: {
                                title: truncate(latest.title, MAX_TITLE_LENGTH),
                                sandboxUrl: latest.sandboxUrl,
                                files: (latest.files ?? {}) as Prisma.InputJsonValue,
                            },
                        },
                    },
                });
                return newProject;
            });

            return { id: created.id };
        }),

    // Per-file changes between two versions (line diff computed server-side)
    compare: protectedProcedure
        .input(z.object({ fromFragmentId: z.string().min(1), toFragmentId: z.string().min(1) }))
        .query(async ({ input, ctx }) => {
            const owned = { message: { project: { userId: ctx.auth.userId } } };
            const select = { id: true, title: true, files: true, createdAt: true } as const;
            const [from, to] = await Promise.all([
                prisma.fragment.findFirst({ where: { id: input.fromFragmentId, ...owned }, select }),
                prisma.fragment.findFirst({ where: { id: input.toFragmentId, ...owned }, select }),
            ]);
            if (!from || !to) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
            }

            const before = asFileMap(from.files);
            const after = asFileMap(to.files);
            const paths = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

            const files: FileChange[] = paths.map((path): FileChange => {
                const a = before[path];
                const b = after[path];
                const binary = (a !== undefined && isDataUrl(a)) || (b !== undefined && isDataUrl(b));

                if (a === undefined || b === undefined) {
                    const status = a === undefined ? "added" : "removed";
                    if (binary) return { path, status, note: "Image file" };
                    const diff = a === undefined ? unifiedDiff("", b ?? "") : unifiedDiff(a, "");
                    return diff ? { path, status, diff } : { path, status, note: "File too large to show" };
                }
                if (a === b) return { path, status: "unchanged" };
                if (binary) return { path, status: "modified", note: "Image file" };
                const diff = unifiedDiff(a, b);
                return diff
                    ? { path, status: "modified", diff }
                    : { path, status: "modified", note: "File too large to show" };
            });

            return {
                from: { id: from.id, title: from.title, createdAt: from.createdAt },
                to: { id: to.id, title: to.title, createdAt: to.createdAt },
                files,
            };
        }),
});
