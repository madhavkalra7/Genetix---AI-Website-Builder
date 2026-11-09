import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  describeReset,
  getDailyLimits,
  isDailyLimitResponse,
  modelGroup,
  nextResetAt,
  requiredRoom,
  usableDailyCap,
  utcDay,
} from "@/lib/token-budget";

describe("token-budget helpers", () => {
  it("groups Sol models as large and everything else as small", () => {
    expect(modelGroup("gpt-6.1-sol")).toBe("large");
    expect(modelGroup("gpt-6-sol")).toBe("large");
    expect(modelGroup("gpt-6.1-terra")).toBe("small");
    expect(modelGroup("o4-mini")).toBe("small");
    expect(modelGroup("console")).toBe("small");
    expect(modelGroup(undefined)).toBe("small");
  });

  it("uses the UTC calendar day and resets at the next 00:00 UTC", () => {
    const d = new Date("2026-11-09T20:15:00+05:30"); // 14:45 UTC
    expect(utcDay(d)).toBe("2026-11-09");
    expect(nextResetAt(d).toISOString()).toBe("2026-11-10T00:00:00.000Z");
    const lateIst = new Date("2026-11-10T03:00:00+05:30"); // still 2026-11-09 in UTC
    expect(utcDay(lateIst)).toBe("2026-11-09");
  });

  it("describes the time left until reset", () => {
    expect(describeReset(new Date("2026-11-09T21:30:00Z"))).toBe("5:30 AM IST (00:00 UTC), in 2h 30m");
    expect(describeReset(new Date("2026-11-09T23:59:30Z"))).toBe("5:30 AM IST (00:00 UTC), in 1m");
  });

  it("defaults to 2.5M Terra / 240K Sol with per-group margins", () => {
    vi.stubEnv("DAILY_TOKEN_LIMIT_SMALL", "");
    vi.stubEnv("DAILY_TOKEN_LIMIT_LARGE", "");
    vi.stubEnv("DAILY_TOKEN_SAFETY_MARGIN", "");
    vi.stubEnv("DAILY_TOKEN_SAFETY_MARGIN_LARGE", "");
    expect(getDailyLimits()).toMatchObject({ small: 2_500_000, large: 240_000, margins: { small: 200_000, large: 24_000 } });
    expect(usableDailyCap("small")).toBe(2_300_000);
    expect(usableDailyCap("large")).toBe(216_000);
    vi.unstubAllEnvs();
  });

  it("lets a 300K build start on Sol once half the usable cap is free", () => {
    vi.stubEnv("DAILY_TOKEN_LIMIT_LARGE", "");
    vi.stubEnv("DAILY_TOKEN_SAFETY_MARGIN_LARGE", "");
    expect(requiredRoom("large", 300_000)).toBe(108_000);
    expect(requiredRoom("large", 8_000)).toBe(8_000);
    expect(requiredRoom("small", 300_000)).toBe(300_000);
    vi.unstubAllEnvs();
  });

  it("recognises the synthetic daily-limit 429", () => {
    expect(isDailyLimitResponse(429, { error: { code: "daily_token_limit" } })).toBe(true);
    expect(isDailyLimitResponse(429, { error: { code: "rate_limit_exceeded" } })).toBe(false);
    expect(isDailyLimitResponse(200, { error: { code: "daily_token_limit" } })).toBe(false);
  });
});
