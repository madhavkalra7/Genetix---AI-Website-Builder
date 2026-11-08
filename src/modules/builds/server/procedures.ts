import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";

export type BuildEvent = { seq?: number; at: string; stage: string; detail?: string; file?: string; code?: string };

// Keep the polled payload small even if a run logs a lot of events
const MAX_EVENTS = 80;
const MAX_DETAIL_LENGTH = 200;
const MAX_FILE_LENGTH = 200;
const MAX_CODE_LENGTH = 6000;
/** Only the most recent code snippets are sent (they feed the live code-writing animation). */
const MAX_EVENTS_WITH_CODE = 3;

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
        const { seq, at, stage, detail, file, code } = item as Record<string, unknown>;
        if (typeof stage !== "string" || !stage) continue;
        const atString =
            typeof at === "string" ? at : at instanceof Date ? at.toISOString() : typeof at === "number" ? new Date(at).toISOString() : "";
        events.push({
            ...(typeof seq === "number" && Number.isFinite(seq) ? { seq } : {}),
            at: atString,
            stage,
            ...(typeof detail === "string" && detail
                ? { detail: detail.length > MAX_DETAIL_LENGTH ? detail.slice(0, MAX_DETAIL_LENGTH - 1) + "…" : detail }
                : {}),
            ...(typeof file === "string" && file ? { file: file.slice(0, MAX_FILE_LENGTH) } : {}),
            ...(typeof code === "string" && code ? { code: code.slice(0, MAX_CODE_LENGTH) } : {}),
        });
    }
    const recent = events.slice(-MAX_EVENTS);
    // Keep polling light: strip code from all but the latest few events that carry it
    let withCode = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
        if (recent[i].code !== undefined && ++withCode > MAX_EVENTS_WITH_CODE) {
            const { code: _dropped, ...rest } = recent[i];
            void _dropped;
            recent[i] = rest;
        }
    }
    return recent;
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
