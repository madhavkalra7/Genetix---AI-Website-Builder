"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Gift, Mail, Share2, UserPlus, MailCheck, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_REFERRAL_CREDITS, REFERRAL_MONTHLY_CAP, buildShareUrls } from "@/lib/referrals";

export default function ReferralsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { user, loading: authLoading } = useAuth();
  const { data: session, status: sessionStatus } = useSession();
  const loggedIn = !!user || !!session?.user;
  const authResolved = !authLoading && sessionStatus !== "loading";

  useEffect(() => {
    if (authResolved && !loggedIn) router.replace("/auth/signin?redirect=/referrals");
  }, [authResolved, loggedIn, router]);

  const { data, isLoading, isError } = useQuery({
    ...trpc.referrals.me.queryOptions(),
    enabled: authResolved && loggedIn,
  });

  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const reward = data?.rewardPerReferral ?? DEFAULT_REFERRAL_CREDITS;
  const cap = data?.monthlyCap ?? REFERRAL_MONTHLY_CAP;
  const link = data?.eligible ? data.link : "";
  const message = `I build websites with AI on Genetix. Sign up with my link and get ${reward} free credits!`;
  const shareUrls = useMemo(() => (link ? buildShareUrls(link, message) : null), [link, message]);

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy, please copy the link manually.");
    }
  };

  const nativeShare = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: "Genetix", text: message, url: link });
    } catch {
      // user cancelled
    }
  };

  if (!authResolved || !loggedIn) {
    return <div className="min-h-screen bg-black pt-16" />;
  }

  return (
    <div className="min-h-screen bg-black text-white pt-16">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-purple-500/15 border border-purple-500/40 mb-6">
            <Gift className="h-7 w-7 text-purple-300" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Give {reward}, get {reward}
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Invite friends to Genetix. When they join and verify their email, you each get {reward} free AI credits.
          </p>
        </div>

        {isLoading ? (
          <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
        ) : isError || !data ? (
          <p className="text-center text-white/60">Couldn&apos;t load your referral link. Please refresh the page.</p>
        ) : !data.eligible ? (
          <p className="text-center text-white/60">Referrals aren&apos;t available for this account.</p>
        ) : (
          <>
            {/* Link + share */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
              <label htmlFor="referral-link" className="block text-sm text-white/60 mb-2">
                Your referral link
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  id="referral-link"
                  readOnly
                  value={data.link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="bg-black/40 border-white/20 text-white font-mono text-sm"
                />
                <Button onClick={copyLink} className="sm:w-32 shrink-0">
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              {shareUrls && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <ShareLink href={shareUrls.whatsapp} label="WhatsApp" />
                  <ShareLink href={shareUrls.twitter} label="X / Twitter" />
                  <ShareLink href={shareUrls.linkedin} label="LinkedIn" />
                  <a
                    href={shareUrls.email}
                    className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </a>
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={nativeShare}
                      className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      More…
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-12">
              <Stat label="Invited" value={data.invited} />
              <Stat label="Joined" value={data.rewarded} />
              <Stat label="Credits earned" value={data.creditsEarned} />
            </div>
          </>
        )}

        {/* How it works */}
        <h2 className="text-2xl font-bold mb-6 text-center">How it works</h2>
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Step icon={<Share2 className="h-5 w-5" />} title="1. Share your link" text="Send your personal link to friends who want to build websites with AI." />
          <Step icon={<UserPlus className="h-5 w-5" />} title="2. They sign up" text="Your friend creates a Genetix account using your link." />
          <Step icon={<Coins className="h-5 w-5" />} title={`3. You both get ${reward}`} text={`Once they verify their email, you each receive ${reward} bonus credits.`} />
        </div>

        {/* Fine print */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-xs text-white/50 space-y-1">
          <p className="flex items-start gap-2">
            <MailCheck className="h-4 w-4 shrink-0" />
            Rewards are granted after your friend verifies their email (Google/GitHub sign-ups count as verified immediately).
          </p>
          <p>The referral must be used when the account is created; it can&apos;t be added to existing accounts.</p>
          <p>You can earn from up to {cap} referrals per calendar month. Friends always get their bonus, even beyond your cap.</p>
        </div>
      </div>
    </div>
  );
}

function ShareLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
    >
      {label}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-white/60 mt-1">{label}</div>
    </div>
  );
}

function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300 mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-white/60">{text}</p>
    </div>
  );
}
