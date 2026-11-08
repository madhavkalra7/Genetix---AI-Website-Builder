import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  REFERRAL_MONTHLY_CAP,
  buildReferralLink,
  computeReferrerEarnings,
  getAppBaseUrl,
  getReferralCredits,
} from "@/lib/referrals";
import { applyReferralForNewUser, getOrCreateReferralCode } from "./service";

export const referralsRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const rewardPerReferral = getReferralCredits();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiquestUserId: true, referralRewardedAt: true },
    });
    if (!user || user.aiquestUserId) {
      return { eligible: false as const, rewardPerReferral, monthlyCap: REFERRAL_MONTHLY_CAP };
    }

    const code = await getOrCreateReferralCode(userId);
    const [invited, rewardedReferrals] = await Promise.all([
      prisma.user.count({ where: { referredById: userId } }),
      prisma.user.findMany({
        where: { referredById: userId, referralRewardedAt: { not: null } },
        select: { referralRewardedAt: true },
      }),
    ]);
    const rewardedDates = rewardedReferrals.map((r) => r.referralRewardedAt as Date);
    const creditsEarned =
      computeReferrerEarnings(rewardedDates, rewardPerReferral, REFERRAL_MONTHLY_CAP) +
      (user.referralRewardedAt ? rewardPerReferral : 0);

    return {
      eligible: true as const,
      code,
      link: buildReferralLink(getAppBaseUrl(), code),
      invited,
      rewarded: rewardedDates.length,
      creditsEarned,
      monthlyCap: REFERRAL_MONTHLY_CAP,
      rewardPerReferral,
    };
  }),

  /**
   * Client-side fallback for capturing a referral (e.g. OAuth signups where the gx_ref cookie
   * couldn't be read). Only works for accounts < 24h old; rewards immediately if verified.
   */
  claim: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const rl = await checkRateLimit(`referral-claim:${ctx.auth.userId}`, 5, 60 * 60 * 1000);
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Please try again in ${rl.retryAfterSec} seconds.`,
        });
      }
      const result = await applyReferralForNewUser(ctx.auth.userId, input.code);
      return { result };
    }),
});
