/**
 * Referral-credits program: pure helpers and constants (no DB access, safe to import from
 * client components and unit tests). Server-side logic lives in
 * src/modules/referrals/server/service.ts.
 */

/** Default credits granted to BOTH the referrer and the new user. */
export const DEFAULT_REFERRAL_CREDITS = 50;

/** A referrer earns from at most this many rewarded referrals per calendar month (UTC). */
export const REFERRAL_MONTHLY_CAP = 20;

/** A referral can only be attached to an account younger than this. */
export const REFERRAL_ATTACH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Cookie + localStorage key used to carry `?ref=<code>` through signup / OAuth redirects. */
export const REFERRAL_COOKIE = "gx_ref";
export const REFERRAL_STORAGE_KEY = "gx_ref";
export const REFERRAL_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export const REFERRAL_CODE_LENGTH = 8;
/** Lowercase a-z + 2-9 without the ambiguous i, l, o, 0, 1. */
export const REFERRAL_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const REFERRAL_CODE_RE = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

type RandomBytes = (length: number) => Uint8Array;

const defaultRandomBytes: RandomBytes = (length) => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Random 8-char code from REFERRAL_CODE_ALPHABET. Uses rejection sampling so every character
 * is equally likely (256 is not a multiple of the alphabet size).
 */
export function generateReferralCode(randomBytes: RandomBytes = defaultRandomBytes): string {
  const n = REFERRAL_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let code = "";
  while (code.length < REFERRAL_CODE_LENGTH) {
    for (const byte of randomBytes(REFERRAL_CODE_LENGTH * 2)) {
      if (byte >= limit) continue;
      code += REFERRAL_CODE_ALPHABET[byte % n];
      if (code.length === REFERRAL_CODE_LENGTH) break;
    }
  }
  return code;
}

/** Trims/lowercases user input; returns null unless it looks like a valid referral code. */
export function normalizeReferralCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toLowerCase();
  return REFERRAL_CODE_RE.test(code) ? code : null;
}

/** REFERRAL_CREDITS env override (positive integer, max 10,000), else the default of 50. */
export function getReferralCredits(env: Record<string, string | undefined> = process.env): number {
  const raw = env.REFERRAL_CREDITS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_REFERRAL_CREDITS;
  const value = Number(raw);
  return value > 0 && value <= 10_000 ? value : DEFAULT_REFERRAL_CREDITS;
}

/** Public base URL: APP_URL, then NEXT_PUBLIC_APP_URL, then NEXTAUTH_URL (no trailing slash). */
export function getAppBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const base = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export function buildReferralLink(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/auth/signup?ref=${encodeURIComponent(code)}`;
}

/** Intent URLs for the share buttons on /referrals. */
export function buildShareUrls(link: string, message: string) {
  const text = `${message} ${link}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    email: `mailto:?subject=${encodeURIComponent("Build websites with AI on Genetix")}&body=${encodeURIComponent(text)}`,
  };
}

/** True when an account is still young enough to have a referral attached. */
export function isWithinAttachWindow(createdAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age < REFERRAL_ATTACH_WINDOW_MS;
}

/** First instant of the calendar month (UTC) containing `date`. */
export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Whether the referrer gets paid for a referral, given how many of their referrals have been
 * rewarded this month INCLUDING the one being rewarded now.
 */
export function referrerEarnsReward(rewardedThisMonthIncludingCurrent: number, cap: number = REFERRAL_MONTHLY_CAP): boolean {
  return rewardedThisMonthIncludingCurrent <= cap;
}

/**
 * Credits a referrer has earned, given the reward dates of their rewarded referrals:
 * per UTC calendar month at most `cap` referrals pay out.
 */
export function computeReferrerEarnings(rewardedAt: Date[], reward: number, cap: number = REFERRAL_MONTHLY_CAP): number {
  const perMonth = new Map<string, number>();
  for (const date of rewardedAt) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
  }
  let total = 0;
  for (const count of perMonth.values()) total += Math.min(count, cap) * reward;
  return total;
}
