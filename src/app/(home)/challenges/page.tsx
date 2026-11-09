"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    CalendarIcon,
    CopyIcon,
    ExternalLinkIcon,
    EyeIcon,
    GitForkIcon,
    GlobeIcon,
    HammerIcon,
    MedalIcon,
    RocketIcon,
    TrophyIcon,
    UsersIcon,
} from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { REMIX_POINTS } from "@/modules/challenges/shared";
import { useNow } from "@/modules/challenges/ui/use-now";

const PLACE_LABELS = ["1st", "2nd", "3rd"];
const PLACE_COLORS = ["text-yellow-300", "text-gray-200", "text-amber-500"];

function formatRange(start: Date | string, end: Date | string) {
    const fmt = (d: Date | string) =>
        new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
    return `${fmt(start)} – ${fmt(end)} (UTC)`;
}

function Countdown({ endsAt }: { endsAt: Date | string }) {
    const now = useNow(1000);
    const ms = Math.max(0, new Date(endsAt).getTime() - now);
    const s = Math.floor(ms / 1000);
    const parts = [
        { label: "days", value: Math.floor(s / 86400) },
        { label: "hrs", value: Math.floor((s % 86400) / 3600) },
        { label: "min", value: Math.floor((s % 3600) / 60) },
        { label: "sec", value: s % 60 },
    ];
    if (ms === 0) {
        return <p className="font-[Orbitron] text-lg text-gray-300">Challenge ended — results soon</p>;
    }
    return (
        <div className="flex justify-center gap-2 sm:gap-3" role="timer" aria-label="Time left in this challenge">
            {parts.map((p) => (
                <div
                    key={p.label}
                    className="flex w-16 flex-col items-center rounded-xl border border-white/10 bg-white/5 py-2 sm:w-20"
                >
                    <span className="font-[Orbitron] text-2xl font-bold tabular-nums text-white sm:text-3xl">
                        {String(p.value).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">{p.label}</span>
                </div>
            ))}
        </div>
    );
}

function SiteThumb({ previewPath, title, className }: { previewPath: string; title: string; className?: string }) {
    return (
        <div className={cn("relative aspect-[16/10] overflow-hidden rounded-md bg-white/5", className)}>
            {/* Live, non-interactive thumbnail from the same-origin /s/<slug> route, scaled to 25% */}
            <iframe
                src={previewPath}
                title={`Preview of ${title}`}
                sandbox="allow-scripts"
                loading="lazy"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left border-0 bg-white"
                style={{ transform: "scale(0.25)" }}
            />
        </div>
    );
}

function Leaderboard({ challengeId }: { challengeId: string }) {
    const trpc = useTRPC();
    const board = useQuery({
        ...trpc.challenges.leaderboard.queryOptions({ challengeId, limit: 50 }),
        refetchInterval: 60_000,
    });

    if (board.isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
                ))}
            </div>
        );
    }
    if (board.isError) {
        return <p className="text-sm text-red-400">{board.error.message || "Could not load the leaderboard."}</p>;
    }
    const items = board.data?.items ?? [];
    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
                <TrophyIcon className="mx-auto size-8 text-purple-300" />
                <p className="mt-3 font-semibold">No entries yet — be the first!</p>
                <p className="mt-1 text-sm text-gray-400">
                    Build something, publish it, then hit &quot;Submit entry&quot; in the Publish dialog.
                </p>
            </div>
        );
    }

    return (
        <ol className="space-y-3">
            {items.map((item) => {
                const place = item.rank ?? item.position;
                return (
                    <li
                        key={item.entryId}
                        className={cn(
                            "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-purple-500/40 sm:gap-4",
                            place <= 3 && "border-purple-500/30 bg-purple-500/[0.06]"
                        )}
                    >
                        <div
                            className={cn(
                                "w-8 shrink-0 text-center font-[Orbitron] text-lg font-bold sm:w-10",
                                PLACE_COLORS[place - 1] ?? "text-gray-400"
                            )}
                        >
                            {place <= 3 ? <MedalIcon className="mx-auto size-6" aria-label={`#${place}`} /> : `#${place}`}
                        </div>
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden w-32 shrink-0 sm:block"
                            aria-label={`Open ${item.title}`}
                        >
                            <SiteThumb previewPath={item.previewPath} title={item.title} />
                        </a>
                        <div className="min-w-0 flex-1">
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-sm font-semibold text-white hover:underline"
                                title={item.title}
                            >
                                {item.title}
                            </a>
                            <p className="truncate text-xs text-gray-400">by {item.author}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1" title="Unique visitors during the challenge">
                                    <EyeIcon className="size-3.5" />
                                    {item.breakdown.visitors.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1" title={`Remixes (×${REMIX_POINTS} points)`}>
                                    <GitForkIcon className="size-3.5" />
                                    {item.breakdown.remixes.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="font-[Orbitron] text-xl font-bold text-white">{item.score.toLocaleString()}</div>
                            <div className="text-[10px] uppercase tracking-wider text-gray-500">points</div>
                        </div>
                        <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="hidden shrink-0 text-gray-300 hover:bg-white/10 hover:text-white md:inline-flex"
                        >
                            <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Open site">
                                <ExternalLinkIcon />
                            </a>
                        </Button>
                    </li>
                );
            })}
        </ol>
    );
}

function PastChallenges() {
    const trpc = useTRPC();
    const past = useQuery(trpc.challenges.past.queryOptions({ limit: 6 }));
    if (past.isLoading || past.isError || !past.data?.length) return null;

    return (
        <section className="mx-auto max-w-5xl px-4 pb-16">
            <h2 className="mb-5 font-[Orbitron] text-xl font-bold sm:text-2xl">Past challenges</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.data.map((c) => (
                    <article key={c.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h3 className="font-semibold text-white">{c.title}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                            <CalendarIcon className="size-3" />
                            {formatRange(c.startsAt, c.endsAt)} · {c.entryCount} {c.entryCount === 1 ? "entry" : "entries"}
                        </p>
                        {c.top.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500">No entries</p>
                        ) : (
                            <ol className="mt-3 space-y-2">
                                {c.top.map((w, i) => (
                                    <li key={w.entryId} className="flex items-center gap-2 text-sm">
                                        <MedalIcon className={cn("size-4 shrink-0", PLACE_COLORS[i])} />
                                        <a
                                            href={w.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="min-w-0 flex-1 truncate text-white hover:underline"
                                            title={w.title}
                                        >
                                            {w.title}
                                        </a>
                                        <span className="shrink-0 truncate text-xs text-gray-400">{w.author}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        {!c.awardedAt && c.top.length > 0 && (
                            <p className="mt-3 text-[11px] text-gray-500">Final results are being tallied.</p>
                        )}
                    </article>
                ))}
            </div>
        </section>
    );
}

const STEPS = [
    { icon: HammerIcon, title: "Build", text: "Start from this week's prompt (or your own idea) and build it with Genetix." },
    { icon: GlobeIcon, title: "Publish", text: "Publish your project to get a public link." },
    { icon: RocketIcon, title: "Submit", text: "In the Publish dialog, hit \"Submit entry\". Up to 3 entries per person." },
    {
        icon: UsersIcon,
        title: "Share",
        text: `Score = unique visitors during the week + ${REMIX_POINTS} points per remix. Ties go to the earlier entry.`,
    },
];

export default function ChallengesPage() {
    const trpc = useTRPC();
    const current = useQuery(trpc.challenges.current.queryOptions());
    const challenge = current.data;

    const copyPrompt = async () => {
        if (!challenge?.prompt) return;
        try {
            await navigator.clipboard.writeText(challenge.prompt);
            toast.success("Starter prompt copied");
        } catch {
            toast.error("Could not copy the prompt");
        }
    };

    const startHref = challenge?.prompt ? `/?prompt=${encodeURIComponent(challenge.prompt)}` : "/";

    return (
        <div className="min-h-screen bg-black pt-16 text-white">
            {/* Hero */}
            <section className="relative overflow-hidden border-b border-white/10">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.2),transparent_60%)]" />
                <div className="relative mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
                    <p className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-200">
                        <TrophyIcon className="size-3.5" />
                        Weekly Build Challenge
                    </p>

                    {current.isLoading ? (
                        <div className="mx-auto mt-6 space-y-3">
                            <div className="mx-auto h-10 w-2/3 animate-pulse rounded bg-white/10" />
                            <div className="mx-auto h-4 w-full animate-pulse rounded bg-white/5" />
                            <div className="mx-auto h-4 w-5/6 animate-pulse rounded bg-white/5" />
                        </div>
                    ) : current.isError || !challenge ? (
                        <p className="mt-6 text-sm text-red-400">
                            {current.error?.message || "Could not load this week's challenge."}
                        </p>
                    ) : (
                        <>
                            <h1 className="mt-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text font-[Orbitron] text-3xl font-bold text-transparent sm:text-5xl">
                                {challenge.title}
                            </h1>
                            <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-300 sm:text-base">
                                {challenge.description}
                            </p>
                            <p className="mt-2 text-xs text-gray-500">
                                {formatRange(challenge.startsAt, challenge.endsAt)} · {challenge.entryCount}{" "}
                                {challenge.entryCount === 1 ? "entry" : "entries"}
                            </p>

                            <div className="mt-8">
                                <Countdown endsAt={challenge.endsAt} />
                            </div>

                            <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2">
                                {challenge.prizes.map((amount, i) => (
                                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                                        <MedalIcon className={cn("mx-auto size-5", PLACE_COLORS[i])} />
                                        <div className="mt-1 font-[Orbitron] text-lg font-bold">{amount}</div>
                                        <div className="text-[11px] text-gray-400">{PLACE_LABELS[i]} · credits</div>
                                    </div>
                                ))}
                            </div>

                            {challenge.prompt && (
                                <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Starter prompt
                                        </span>
                                        <button
                                            type="button"
                                            onClick={copyPrompt}
                                            className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-white"
                                        >
                                            <CopyIcon className="size-3.5" />
                                            Copy
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-200">{challenge.prompt}</p>
                                </div>
                            )}

                            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                <Button variant="venom" size="lg" asChild className="px-8">
                                    <Link href={startHref}>
                                        <HammerIcon />
                                        Start building
                                    </Link>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    asChild
                                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                                >
                                    <a href="#leaderboard">View leaderboard</a>
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* How it works */}
            <section className="mx-auto max-w-5xl px-4 py-12">
                <h2 className="mb-5 font-[Orbitron] text-xl font-bold sm:text-2xl">How it works</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((step, i) => (
                        <div key={step.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2">
                                <span className="flex size-8 items-center justify-center rounded-full bg-purple-500/15 text-purple-200">
                                    <step.icon className="size-4" />
                                </span>
                                <span className="text-xs text-gray-500">Step {i + 1}</span>
                            </div>
                            <h3 className="mt-3 font-semibold">{step.title}</h3>
                            <p className="mt-1 text-sm text-gray-400">{step.text}</p>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-xs text-gray-500">
                    A new challenge starts every Monday 00:00 UTC and ends Sunday 23:59 UTC. Prizes are added to the
                    winners&apos; credit balance shortly after it ends; only each person&apos;s best entry counts for prizes.
                </p>
            </section>

            {/* Leaderboard */}
            <section id="leaderboard" className="mx-auto max-w-5xl scroll-mt-20 px-4 pb-12">
                <div className="mb-5 flex items-end justify-between gap-3">
                    <h2 className="font-[Orbitron] text-xl font-bold sm:text-2xl">Live leaderboard</h2>
                    <span className="text-xs text-gray-500">Updates every minute</span>
                </div>
                {challenge ? (
                    <Leaderboard challengeId={challenge.id} />
                ) : current.isLoading ? (
                    <div className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
                ) : null}
            </section>

            <PastChallenges />
        </div>
    );
}
