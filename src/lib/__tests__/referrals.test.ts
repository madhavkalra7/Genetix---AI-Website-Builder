import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFERRAL_CREDITS,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  buildReferralLink,
  buildShareUrls,
  computeReferrerEarnings,
  generateReferralCode,
  getAppBaseUrl,
  getReferralCredits,
  isWithinAttachWindow,
  normalizeReferralCode,
  referrerEarnsReward,
  startOfUtcMonth,
} from "@/lib/referrals";

describe("generateReferralCode", () => {
  it("produces 8 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      expect(code).toMatch(/^[a-z2-9]+$/);
      for (const ch of code) expect(REFERRAL_CODE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[ilo01]/);
    }
  });

  it("rejects biased bytes (rejection sampling)", () => {
    // 255 is above the unbiased limit and must be skipped; 0 maps to 'a', 1 to 'b'.
    const bytes = [255, 255, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
    const code = generateReferralCode((n) => Uint8Array.from(bytes.slice(0, n)));
    expect(code).toBe("abababab");
  });

  it("is effectively unique", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateReferralCode()));
    expect(codes.size).toBe(2000);
  });
});

describe("normalizeReferralCode", () => {
  it("trims and lowercases valid codes", () => {
    expect(normalizeReferralCode("  ABCD2345 ")).toBe("abcd2345");
  });
  it("rejects invalid input", () => {
    expect(normalizeReferralCode("abc")).toBeNull();
    expect(normalizeReferralCode("abcd1234")).toBeNull(); // '1' is excluded
    expect(normalizeReferralCode("abcd2345x")).toBeNull();
    expect(normalizeReferralCode("abcd-345")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(42)).toBeNull();
  });
});

describe("getReferralCredits", () => {
  it("defaults to 50", () => {
    expect(getReferralCredits({})).toBe(DEFAULT_REFERRAL_CREDITS);
    expect(DEFAULT_REFERRAL_CREDITS).toBe(50);
  });
  it("honours a valid env override and ignores bad ones", () => {
    expect(getReferralCredits({ REFERRAL_CREDITS: "25" })).toBe(25);
    expect(getReferralCredits({ REFERRAL_CREDITS: "0" })).toBe(50);
    expect(getReferralCredits({ REFERRAL_CREDITS: "-5" })).toBe(50);
    expect(getReferralCredits({ REFERRAL_CREDITS: "abc" })).toBe(50);
    expect(getReferralCredits({ REFERRAL_CREDITS: "999999" })).toBe(50);
  });
});

describe("links", () => {
  it("picks the base URL in priority order and strips trailing slashes", () => {
    expect(getAppBaseUrl({ APP_URL: "https://a.com/", NEXT_PUBLIC_APP_URL: "https://b.com", NEXTAUTH_URL: "https://c.com" })).toBe("https://a.com");
    expect(getAppBaseUrl({ NEXT_PUBLIC_APP_URL: "https://b.com", NEXTAUTH_URL: "https://c.com" })).toBe("https://b.com");
    expect(getAppBaseUrl({ NEXTAUTH_URL: "https://c.com//" })).toBe("https://c.com");
    expect(getAppBaseUrl({})).toBe("http://localhost:3000");
  });

  it("builds the signup link", () => {
    expect(buildReferralLink("https://genetix.app/", "abcd2345")).toBe("https://genetix.app/auth/signup?ref=abcd2345");
  });

  it("builds encoded share intent URLs", () => {
    const urls = buildShareUrls("https://genetix.app/auth/signup?ref=abcd2345", "Join me & build!");
    expect(urls.whatsapp).toContain("https://wa.me/?text=");
    expect(urls.whatsapp).toContain(encodeURIComponent("https://genetix.app/auth/signup?ref=abcd2345"));
    expect(urls.twitter).toContain("twitter.com/intent/tweet");
    expect(urls.twitter).toContain("Join%20me%20%26%20build!");
    expect(urls.linkedin).toContain("linkedin.com/sharing/share-offsite/?url=");
    expect(urls.email.startsWith("mailto:?subject=")).toBe(true);
  });
});

describe("attach window", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("accepts accounts younger than 24h only", () => {
    expect(isWithinAttachWindow(new Date("2026-11-08T11:00:00Z"), now)).toBe(true);
    expect(isWithinAttachWindow(new Date("2026-11-07T12:00:01Z"), now)).toBe(true);
    expect(isWithinAttachWindow(new Date("2026-11-07T12:00:00Z"), now)).toBe(false);
    expect(isWithinAttachWindow(new Date("2026-11-09T12:00:00Z"), now)).toBe(false);
  });
});

describe("monthly cap", () => {
  it("computes the UTC month start", () => {
    expect(startOfUtcMonth(new Date("2026-11-30T23:59:59Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("pays the referrer up to and including the cap", () => {
    expect(referrerEarnsReward(1, 20)).toBe(true);
    expect(referrerEarnsReward(20, 20)).toBe(true);
    expect(referrerEarnsReward(21, 20)).toBe(false);
  });

  it("sums earnings per month with the cap applied", () => {
    const nov = Array.from({ length: 25 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + (i % 28))));
    const dec = [new Date("2026-12-02T00:00:00Z"), new Date("2026-12-03T00:00:00Z")];
    expect(computeReferrerEarnings([...nov, ...dec], 50, 20)).toBe(20 * 50 + 2 * 50);
    expect(computeReferrerEarnings([], 50, 20)).toBe(0);
  });
});
