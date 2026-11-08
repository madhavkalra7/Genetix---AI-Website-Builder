"use client";

import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SEC,
  REFERRAL_STORAGE_KEY,
  normalizeReferralCode,
} from "@/lib/referrals";

/** Persist a referral code in localStorage + the gx_ref cookie (survives OAuth redirects). */
export function storeReferralCode(raw: string): string | null {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // storage disabled: the cookie still works
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REFERRAL_COOKIE}=${code}; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}`;
  return code;
}

export function readStoredReferralCode(): string | null {
  try {
    const fromStorage = normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([^;]*)`));
  return match ? normalizeReferralCode(match[1]) : null;
}

export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
  document.cookie = `${REFERRAL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
