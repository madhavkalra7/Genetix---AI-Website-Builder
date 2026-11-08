import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { isEmailVerified } from "@/lib/auth";
import {
  REFERRAL_MONTHLY_CAP,
  generateReferralCode,
  getReferralCredits,
  isWithinAttachWindow,
  normalizeReferralCode,
  referrerEarnsReward,
  startOfUtcMonth,
} from "@/lib/referrals";

/** Same defaults as src/lib/usage.ts uses when a UserCredits row is missing. */
const FREE_PLAN_CREDITS = 3;

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Returns the user's referral code, generating one on first request (retries on collision). */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (user.referralCode) return user.referralCode;
    try {
      // Only set when still empty, so two concurrent first requests agree on one code.
      await prisma.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: generateReferralCode() },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Collision with another user's code: loop and try a new one.
    }
  }
  throw new Error("Could not generate a referral code, please try again");
}

export type AttachResult =
  | "attached"
  | "invalid_code"
  | "unknown_code"
  | "self_referral"
  | "already_referred"
  | "too_late"
  | "not_eligible";

/**
 * Records that `userId` was invited by the owner of `rawCode`. Only for brand-new accounts
 * (< 24h), never self-referrals, never for AIQuest users, and never overwrites a referrer.
 * Does NOT grant credits (see grantReferralRewardIfEligible).
 */
export async function attachReferral(userId: string, rawCode: unknown): Promise<AttachResult> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return "invalid_code";

  const [user, referrer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true, referredById: true, aiquestUserId: true, referralCode: true },
    }),
    prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, aiquestUserId: true, isActive: true },
    }),
  ]);
  if (!user) return "not_eligible";
  if (!referrer) return "unknown_code";
  if (referrer.id === user.id) return "self_referral";
  if (user.aiquestUserId || referrer.aiquestUserId || !referrer.isActive) return "not_eligible";
  if (user.referredById) return "already_referred";
  if (!isWithinAttachWindow(user.createdAt)) return "too_late";

  const { count } = await prisma.user.updateMany({
    where: { id: user.id, referredById: null },
    data: { referredById: referrer.id },
  });
  return count === 1 ? "attached" : "already_referred";
}

async function addBonusCredits(tx: Prisma.TransactionClient, userId: string, amount: number) {
  await tx.userCredits.upsert({
    where: { userId },
    update: { creditsLimit: { increment: amount } },
    create: { userId, creditsUsed: 0, creditsLimit: FREE_PLAN_CREDITS + amount, lastReset: new Date() },
  });
}

export interface RewardResult {
  rewarded: boolean;
  referrerRewarded: boolean;
  credits: number;
}

/**
 * Pays out a referral once the referred user has a verified email. Idempotent and race-safe:
 * the referralRewardedAt claim is a conditional update, and credits are only granted by the
 * request that won it, inside the same transaction. Never throws (logs instead) so it can be
 * called from auth flows without breaking them.
 */
export async function grantReferralRewardIfEligible(userId: string): Promise<RewardResult> {
  const none: RewardResult = { rewarded: false, referrerRewarded: false, credits: 0 };
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true, createdAt: true, referredById: true, referralRewardedAt: true, aiquestUserId: true },
    });
    if (!user || !user.referredById || user.referralRewardedAt || user.aiquestUserId) return none;
    if (!isEmailVerified(user)) return none;

    const referrerId = user.referredById;
    const credits = getReferralCredits();

    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.user.updateMany({
        where: { id: userId, referralRewardedAt: null, referredById: { not: null } },
        data: { referralRewardedAt: now },
      });
      if (claimed.count !== 1) return none;

      await addBonusCredits(tx, userId, credits);

      const referrer = await tx.user.findUnique({
        where: { id: referrerId },
        select: { id: true, aiquestUserId: true, isActive: true },
      });
      let referrerRewarded = false;
      if (referrer && !referrer.aiquestUserId && referrer.isActive) {
        // Includes the referral just claimed above.
        const rewardedThisMonth = await tx.user.count({
          where: { referredById: referrerId, referralRewardedAt: { gte: startOfUtcMonth(now) } },
        });
        if (referrerEarnsReward(rewardedThisMonth, REFERRAL_MONTHLY_CAP)) {
          await addBonusCredits(tx, referrerId, credits);
          referrerRewarded = true;
        }
      }
      return { rewarded: true, referrerRewarded, credits };
    });
  } catch (err) {
    console.error("[referrals] failed to grant referral reward:", err);
    return none;
  }
}

/** Attach + (if already verified, e.g. OAuth) reward in one go. Never throws. */
export async function applyReferralForNewUser(userId: string, rawCode: unknown): Promise<AttachResult | "error"> {
  try {
    const result = await attachReferral(userId, rawCode);
    if (result === "attached") await grantReferralRewardIfEligible(userId);
    return result;
  } catch (err) {
    console.error("[referrals] failed to apply referral:", err);
    return "error";
  }
}
