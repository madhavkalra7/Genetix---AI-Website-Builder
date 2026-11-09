import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeUserUrl } from "@/lib/style-dna";
import { StyleDnaExtractError, StyleDnaFetchError, extractStyleDnaFromUrl } from "./extract";

/** 10 extractions per hour per user. */
export const STYLE_DNA_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 } as const;

export const styleDnaRouter = createTRPCRouter({
  /** Paste a website URL → its design system as a reusable (validated) theme. */
  extract: protectedProcedure
    .input(z.object({ url: z.string().trim().min(1, { message: "Enter a website URL" }).max(2048) }))
    .mutation(async ({ input, ctx }) => {
      const url = normalizeUserUrl(input.url);
      if (!url) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That doesn't look like a website URL." });
      }

      const limit = await checkRateLimit(`styledna:${ctx.auth.userId}`, STYLE_DNA_RATE_LIMIT.limit, STYLE_DNA_RATE_LIMIT.windowMs);
      if (!limit.ok) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You've extracted a lot of styles — try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        });
      }

      try {
        const styleDna = await extractStyleDnaFromUrl(url);
        return { styleDna, sourceHost: styleDna.sourceHost };
      } catch (err) {
        if (err instanceof StyleDnaFetchError) {
          const code = err.kind === "invalid" || err.kind === "forbidden" ? "BAD_REQUEST" : "PRECONDITION_FAILED";
          throw new TRPCError({ code, message: err.message, cause: err });
        }
        if (err instanceof StyleDnaExtractError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message, cause: err });
        }
        console.error("[style-dna] unexpected error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't read that site's styles." });
      }
    }),
});
