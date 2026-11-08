"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { clearStoredReferralCode, readStoredReferralCode } from "./referral-storage";

// Module-level so several mounted <UserControl /> instances only claim once per page load.
let claimAttempted = false;

/**
 * After login, if a referral code from /auth/signup?ref=... is still stored, send it to
 * `referrals.claim` once. The server only accepts it for accounts < 24h old (and ignores it if
 * the OAuth callback already attached it), so this is a harmless no-op for everyone else.
 */
export function useReferralClaim(enabled: boolean) {
  const trpc = useTRPC();
  const claim = useMutation(trpc.referrals.claim.mutationOptions());
  const { mutate } = claim;

  useEffect(() => {
    if (!enabled || claimAttempted) return;
    const code = readStoredReferralCode();
    if (!code) return;
    claimAttempted = true;
    mutate(
      { code },
      {
        onSuccess: ({ result }) => {
          clearStoredReferralCode();
          if (result === "attached") toast.success("Referral applied! Bonus credits are on their way.");
        },
        onError: (err) => {
          // Keep the code for a later retry only when rate limited.
          if (err.data?.code !== "TOO_MANY_REQUESTS") clearStoredReferralCode();
        },
      },
    );
  }, [enabled, mutate]);
}
