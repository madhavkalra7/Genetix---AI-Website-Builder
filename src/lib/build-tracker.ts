// Build tracking: one `Build` row per code-agent run.
// - Live progress for the UI (stage + ordered events)
// - Token usage / cost (updated by the Responses bridge per LLM call)
// - Logs for the admin dashboard (status, QA issues, review summary, errors)
//
// Inngest replays the function body after every step, so progress calls made outside
// steps run again on replay. Every event therefore carries a deterministic sequence
// number and is only appended once.

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

export type BuildStage =
  | "starting" | "searching" | "planning" | "writing" | "editing" | "checking" | "fixing"
  | "reviewing" | "browser-testing" | "design-review" | "saving" | "done" | "failed";

export interface BuildEvent { seq: number; at: string; stage: BuildStage; detail?: string; file?: string; code?: string }

/** Max code characters stored per event (feeds the live code-writing animation). */
const MAX_EVENT_CODE = 6000;

export async function createBuild(data: {
  projectId: string; isApp: boolean; userId: string | null; model: string; reasoningEffort: string;
}): Promise<string> {
  const build = await prisma.build.create({
    data: { ...data, status: "running", stage: "starting", events: [] },
    select: { id: true },
  });
  return build.id;
}

/** Creates a tracker bound to one build. All methods are best-effort and never throw. */
export function createBuildTracker(buildId: string | null) {
  let seq = 0;
  let queue: Promise<unknown> = Promise.resolve();
  // Events already stored, loaded once per invocation (replays skip known seqs without a query)
  let stored: BuildEvent[] | null = null;

  const run = (fn: () => Promise<unknown>) => {
    queue = queue.then(fn).catch((e) => console.warn("⚠️ build tracker:", e instanceof Error ? e.message : e));
    return queue;
  };

  return {
    id: buildId,

    /** Append a progress event (idempotent across Inngest replays). */
    event(stage: BuildStage, detail?: string, extra?: { file?: string; code?: string }) {
      const mySeq = ++seq;
      if (!buildId) return Promise.resolve();
      return run(async () => {
        if (!stored) {
          const build = await prisma.build.findUnique({ where: { id: buildId }, select: { events: true } });
          stored = (Array.isArray(build?.events) ? build!.events : []) as unknown as BuildEvent[];
        }
        if (stored.some((e) => e.seq === mySeq)) return; // already recorded (Inngest replay)
        stored.push({
          seq: mySeq,
          at: new Date().toISOString(),
          stage,
          ...(detail ? { detail: detail.slice(0, 200) } : {}),
          ...(extra?.file ? { file: extra.file.slice(0, 200) } : {}),
          ...(extra?.code ? { code: extra.code.slice(0, MAX_EVENT_CODE) } : {}),
        });
        // Keep the row small: only the latest 3 events keep their code
        let withCode = 0;
        for (let i = stored.length - 1; i >= 0; i--) {
          if (stored[i].code && ++withCode > 3) delete stored[i].code;
        }
        await prisma.build.update({
          where: { id: buildId },
          data: { stage, events: stored as unknown as Prisma.InputJsonValue },
        });
      });
    },

    addQaIssues(count: number) {
      if (!buildId || count <= 0) return Promise.resolve();
      return run(() => prisma.build.update({ where: { id: buildId }, data: { qaIssues: { increment: count } } }));
    },

    finish(status: "succeeded" | "failed", extra: { reviewSummary?: string | null; error?: string | null } = {}) {
      if (!buildId) return Promise.resolve();
      return run(() =>
        prisma.build.update({
          where: { id: buildId },
          data: {
            status,
            stage: status === "succeeded" ? "done" : "failed",
            finishedAt: new Date(),
            ...(extra.reviewSummary !== undefined ? { reviewSummary: extra.reviewSummary?.slice(0, 4000) ?? null } : {}),
            ...(extra.error !== undefined ? { error: extra.error?.slice(0, 2000) ?? null } : {}),
          },
        })
      );
    },

    flush: () => queue,
  };
}

/** Called by the Responses bridge after each LLM call (once per call, never replayed). */
export async function recordBuildUsage(
  buildId: string,
  usage: { input: number; cached: number; output: number; reasoning: number }
): Promise<{ totalTokens: number } | null> {
  try {
    const b = await prisma.build.update({
      where: { id: buildId },
      data: {
        llmCalls: { increment: 1 },
        inputTokens: { increment: usage.input },
        cachedTokens: { increment: usage.cached },
        outputTokens: { increment: usage.output },
        reasoningTokens: { increment: usage.reasoning },
      },
      select: { inputTokens: true, outputTokens: true },
    });
    return { totalTokens: b.inputTokens + b.outputTokens };
  } catch {
    return null; // unknown build id (e.g. old URL) — ignore
  }
}

export async function getBuildTokenTotal(buildId: string): Promise<number> {
  const b = await prisma.build.findUnique({ where: { id: buildId }, select: { inputTokens: true, outputTokens: true } });
  return b ? b.inputTokens + b.outputTokens : 0;
}

/** Per-build token budget (input + output). Configure with BUILD_TOKEN_BUDGET. */
export const BUILD_TOKEN_BUDGET = Number(process.env.BUILD_TOKEN_BUDGET) > 0 ? Number(process.env.BUILD_TOKEN_BUDGET) : 300_000;
