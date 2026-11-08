import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";

export type BuildEvent = { at: string; stage: string; detail?: string };

// Keep the polled payload small even if a run logs a lot of events
const MAX_EVENTS = 80;
const MAX_DETAIL_LENGTH = 200;

/** Defensive parse of the events JSON written by the build pipeline. */
const normalizeEvents = (raw: unknown): BuildEvent[] => {
    if (!Array.isArray(raw)) return [];
    // The pipeline tags events with a monotonic `seq`; order by it when present (stable otherwise)
    const ordered = raw
        .map((item, index) => ({ item, index }))
        .sort((x, y) => {
            const sx = (x.item as { seq?: unknown } | null)?.seq;
            const sy = (y.item as { seq?: unknown } | null)?.seq;
            return typeof sx === "number" && typeof sy === "number" ? sx - sy || x.index - y.index : x.index - y.index;
        })
        .map(({ item }) => item as unknown);
    const events: BuildEvent[] = [];
    for (const item of ordered) {
        if (!item || typeof item !== "object") continue;
        const { at, stage, detail } = item as Record<string, unknown>;
        if (typeof stage !== "string" || !stage) continue;
        const atString =
            typeof at === "string" ? at : at instanceof Date ? at.toISOString() : typeof at === "number" ? new Date(at).toISOString() : "";
        events.push({
            at: atString,
            stage,
            ...(typeof detail === "string" && detail
                ? { detail: detail.length > MAX_DETAIL_LENGTH ? detail.slice(0, MAX_DETAIL_LENGTH - 1) + "…" : detail }
                : {}),
        });
    }
    return events.slice(-MAX_EVENTS);
};

export const buildsRouter = createTRPCRouter({
    // Most recent build (live progress) for a project the caller owns
    getLatest: protectedProcedure
        .input(
            z.object({
                projectId: z.string().min(1, { message: "Project ID is required" }),
                isApp: z.boolean().optional().default(false),
            }),
        )
        .query(async ({ input, ctx }) => {
            const owner = input.isApp
                ? await prisma.appProject.findFirst({
                      where: { id: input.projectId, userId: ctx.auth.userId },
                      select: { id: true },
                  })
                : await prisma.project.findFirst({
                      where: { id: input.projectId, userId: ctx.auth.userId },
                      select: { id: true },
                  });
            if (!owner) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }

            const build = await prisma.build.findFirst({
                where: { projectId: input.projectId, isApp: input.isApp },
                orderBy: { startedAt: "desc" },
                select: {
                    id: true,
                    status: true,
                    stage: true,
                    events: true,
                    startedAt: true,
                    finishedAt: true,
                    qaIssues: true,
                    reviewSummary: true,
                },
            });
            if (!build) return null;

            return { ...build, events: normalizeEvents(build.events) };
        }),
});
