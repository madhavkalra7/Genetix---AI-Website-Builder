import { NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "./db";

/**
 * Sliding-window rate limiting backed by the RateLimitHit table (works across serverless
 * instances, unlike an in-memory limiter). Keys look like "<action>:<userId|ip>".
 */

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the next attempt is allowed (0 when ok). */
  retryAfterSec: number;
}

const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_PROBABILITY = 0.01;

/**
 * Counts hits for `key` within the last `windowMs`. If the count is already >= `limit`
 * the call is rejected (and NOT recorded); otherwise a hit is recorded and the call allowed.
 * Fails open on database errors so a DB hiccup never locks everyone out.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);

  try {
    // Opportunistic cleanup of stale rows (~1% of calls), never awaited by the caller's path.
    if (Math.random() < CLEANUP_PROBABILITY) {
      prisma.rateLimitHit
        .deleteMany({ where: { createdAt: { lt: new Date(now - CLEANUP_AGE_MS) } } })
        .catch((err) => console.error("[rate-limit] cleanup failed:", err));
    }

    const count = await prisma.rateLimitHit.count({
      where: { key, createdAt: { gte: windowStart } },
    });

    if (count >= limit) {
      // The window frees up when the oldest hit that still counts falls out of it.
      const oldest = await prisma.rateLimitHit.findFirst({
        where: { key, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const freeAt = oldest ? oldest.createdAt.getTime() + windowMs : now + windowMs;
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((freeAt - now) / 1000)) };
    }

    await prisma.rateLimitHit.create({ data: { key } });
    return { ok: true, retryAfterSec: 0 };
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return { ok: true, retryAfterSec: 0 };
  }
}

type HeaderSource = { headers: Headers } | Headers;

/** Best-effort client IP from proxy headers (x-forwarded-for first hop, then x-real-ip). */
export function getClientIp(req: HeaderSource): string {
  const headers = req instanceof Headers ? req : req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

/** 429 JSON response with a Retry-After header for route handlers. */
export function rateLimitResponse(retryAfterSec: number, message?: string): NextResponse {
  return NextResponse.json(
    {
      error: message ?? `Too many requests. Please try again in ${retryAfterSec} seconds.`,
      retryAfter: retryAfterSec,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/** Build limit shared by every mutation that starts an AI build: 10 per 10 minutes per user. */
export const BUILD_RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 } as const;

/** Throws TRPCError TOO_MANY_REQUESTS when the user is starting builds too quickly. */
export async function enforceBuildRateLimit(userId: string): Promise<void> {
  const result = await checkRateLimit(`build:${userId}`, BUILD_RATE_LIMIT.limit, BUILD_RATE_LIMIT.windowMs);
  if (!result.ok) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You're building too fast — try again in ${result.retryAfterSec} seconds.`,
    });
  }
}
