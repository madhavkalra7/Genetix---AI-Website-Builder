// tRPC-facing guard for the daily OpenAI token meter (see src/lib/token-budget.ts).
import { TRPCError } from "@trpc/server";
import { DailyTokenLimitError, TOKEN_ESTIMATES, assertDailyBudget } from "@/lib/token-budget";

/** Models used by the build pipeline (keep in sync with src/inngest/functions.ts). */
export const BUILD_MODELS = { standard: "gpt-6.1-terra", advanced: "gpt-6.1-sol" } as const;

/**
 * Refuse to START AI work when today's remaining tokens for that model group can't cover it.
 * Builds need room for a full build (the per-build cap) so they don't run out halfway.
 */
export async function ensureDailyTokenBudget(
  kind: "build" | "quickEdit" | "chat",
  opts: { advanced?: boolean } = {}
): Promise<void> {
  const model = opts.advanced ? BUILD_MODELS.advanced : BUILD_MODELS.standard;
  try {
    await assertDailyBudget(model, TOKEN_ESTIMATES[kind]);
  } catch (e) {
    if (e instanceof DailyTokenLimitError) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: e.message });
    }
    throw e;
  }
}
