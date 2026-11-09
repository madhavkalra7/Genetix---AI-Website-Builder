// Daily OpenAI token meter.
//
// OpenAI's data-sharing free allowance is per UTC day and per model group:
//   - "small" group (Luna / Terra / mini-class models) — e.g. 2.5M tokens/day
//   - "large" group (Sol-class models)                  — 240K tokens/day by default
// Every OpenAI call Genetix makes records its tokens here; before starting AI work we check the
// group's remaining budget and pause (friendly error) until 00:00 UTC (5:30 AM IST) when exceeded.
// Genetix uses its own API key, so this count is the whole picture.

import { prisma } from "@/lib/db";

export type ModelGroup = "small" | "large";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Configurable limits (tokens per UTC day) and per-group safety margins kept free for in-flight
 * work. New AI work pauses once usage reaches `limit − margin` (the usable cap).
 */
export function getDailyLimits() {
  const small = num(process.env.DAILY_TOKEN_LIMIT_SMALL, 2_500_000);
  const large = num(process.env.DAILY_TOKEN_LIMIT_LARGE, 240_000);
  return {
    small,
    large,
    margins: {
      small: Math.min(num(process.env.DAILY_TOKEN_SAFETY_MARGIN, 200_000), small / 2),
      large: Math.min(num(process.env.DAILY_TOKEN_SAFETY_MARGIN_LARGE, Math.round(large * 0.1)), large / 2),
    } as Record<ModelGroup, number>,
  };
}

/** Tokens a group may use per day before new AI work pauses (limit − margin). */
export function usableDailyCap(group: ModelGroup): number {
  const limits = getDailyLimits();
  return limits[group] - limits.margins[group];
}

/**
 * Room required before starting work of `estimate` tokens. Clamped to half the group's usable cap
 * so big jobs (e.g. a 300K-token build) can still start on a small group like Sol (240K/day);
 * the build is told to wrap up if the cap is reached mid-run.
 */
export function requiredRoom(group: ModelGroup, estimate: number): number {
  return Math.max(1, Math.min(estimate, Math.floor(usableDailyCap(group) / 2)));
}

/** Sol-class models are in the large group; everything else Genetix uses is small. */
export function modelGroup(model: string | null | undefined): ModelGroup {
  return /(^|[-.])sol\b/i.test(model ?? "") ? "large" : "small";
}

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Next reset: 00:00 UTC tomorrow. */
export function nextResetAt(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

/** "5:30 AM IST (00:00 UTC), in 3h 12m" */
export function describeReset(now = new Date()): string {
  const ms = nextResetAt(now).getTime() - now.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.max(1, Math.round((ms % 3_600_000) / 60_000));
  return `5:30 AM IST (00:00 UTC), in ${h > 0 ? `${h}h ` : ""}${m}m`;
}

export class DailyTokenLimitError extends Error {
  constructor(public group: ModelGroup, public resetAt: Date) {
    super(`Genetix has reached today's AI limit. It resets at ${describeReset()}.`);
    this.name = "DailyTokenLimitError";
  }
}

/** Record tokens used by one OpenAI call (atomic upsert). Never throws. */
export async function recordDailyTokens(model: string | null | undefined, tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const group = modelGroup(model);
  const day = utcDay();
  try {
    await prisma.$executeRaw`
      INSERT INTO "DailyTokenUsage" ("day", "group", "tokens", "requests", "updatedAt")
      VALUES (${day}, ${group}, ${Math.round(tokens)}, 1, NOW())
      ON CONFLICT ("day", "group")
      DO UPDATE SET "tokens" = "DailyTokenUsage"."tokens" + EXCLUDED."tokens",
                    "requests" = "DailyTokenUsage"."requests" + 1,
                    "updatedAt" = NOW()`;
  } catch (e) {
    console.warn("⚠️ Could not record daily token usage:", e instanceof Error ? e.message : e);
  }
}

/** Convenience: record from an OpenAI `usage` object (Responses or Chat Completions shape). */
export async function recordUsageObject(
  model: string | null | undefined,
  usage: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined
): Promise<void> {
  if (!usage) return;
  const total =
    usage.total_tokens ??
    (usage.input_tokens ?? usage.prompt_tokens ?? 0) + (usage.output_tokens ?? usage.completion_tokens ?? 0);
  await recordDailyTokens(model, total);
}

export async function getTodayUsage(): Promise<Record<ModelGroup, { tokens: number; requests: number }>> {
  const rows = await prisma.dailyTokenUsage.findMany({ where: { day: utcDay() } });
  const out = { small: { tokens: 0, requests: 0 }, large: { tokens: 0, requests: 0 } };
  for (const r of rows) {
    if (r.group === "small" || r.group === "large") out[r.group] = { tokens: r.tokens, requests: r.requests };
  }
  return out;
}

/** Remaining tokens for the model's group today (limit − margin − used). Fails open on DB errors. */
export async function remainingDailyTokens(model: string | null | undefined): Promise<number> {
  const group = modelGroup(model);
  try {
    const row = await prisma.dailyTokenUsage.findUnique({ where: { day_group: { day: utcDay(), group } } });
    return usableDailyCap(group) - (row?.tokens ?? 0);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Throw DailyTokenLimitError unless at least `estimate` tokens remain today for this model.
 * Use a full build's budget as the estimate before starting a build, a small one for chat calls.
 */
export async function assertDailyBudget(model: string | null | undefined, estimate = 0): Promise<void> {
  const remaining = await remainingDailyTokens(model);
  if (remaining < requiredRoom(modelGroup(model), estimate)) {
    throw new DailyTokenLimitError(modelGroup(model), nextResetAt());
  }
}

/** Typical sizes used for pre-checks. */
export const TOKEN_ESTIMATES = {
  /** A full build may use up to the per-build cap; only start it if that fits. */
  build: num(process.env.BUILD_TOKEN_BUDGET, 300_000),
  quickEdit: 40_000,
  chat: 8_000,
  vision: 12_000,
  small: 2_000,
} as const;

/**
 * Drop-in replacement for `fetch` on OpenAI endpoints: checks today's budget first (returns a
 * 429-style Response when exhausted, which callers already treat as an error) and records the
 * tokens reported in the reply. Use for every direct OpenAI HTTP call.
 */
export async function meteredOpenAIFetch(url: string, init: RequestInit & { body?: string }, estimate: number = TOKEN_ESTIMATES.chat): Promise<Response> {
  let model: string | undefined;
  try {
    model = typeof init.body === "string" ? (JSON.parse(init.body).model as string | undefined) : undefined;
  } catch {
    model = undefined;
  }
  if ((await remainingDailyTokens(model)) < requiredRoom(modelGroup(model), estimate)) {
    const err = new DailyTokenLimitError(modelGroup(model), nextResetAt());
    return new Response(JSON.stringify({ error: { message: err.message, code: "daily_token_limit" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const res = await fetch(url, init);
  try {
    const data = await res.clone().json();
    await recordUsageObject(data?.model ?? model, data?.usage);
  } catch {
    /* non-JSON or no usage: nothing to record */
  }
  return res;
}

export function isDailyLimitResponse(status: number, body: unknown): boolean {
  return status === 429 && (body as { error?: { code?: string } } | null)?.error?.code === "daily_token_limit";
}
