"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
    ANALYTICS_RANGES,
    countryFlag,
    countryName,
    type AnalyticsRange,
    type DailyPoint,
} from "@/modules/analytics/shared";

interface SiteAnalyticsProps {
    projectId: string;
    className?: string;
}

const numberFormat = new Intl.NumberFormat();
const formatNumber = (n: number) => numberFormat.format(n);

const formatDay = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function SiteAnalytics({ projectId, className }: SiteAnalyticsProps) {
    const trpc = useTRPC();
    const [days, setDays] = useState<AnalyticsRange>(7);

    const stats = useQuery({
        ...trpc.analytics.siteStats.queryOptions({ projectId, days }),
        placeholderData: (prev) => prev,
        staleTime: 60_000,
    });
    const data = stats.data;

    return (
        <section className={cn("grid gap-3 rounded-md border p-3 min-w-0", className)} aria-label="Site analytics">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                    Analytics
                    {stats.isFetching && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
                </h3>
                <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-md bg-muted p-0.5 text-xs">
                    {ANALYTICS_RANGES.map((r) => (
                        <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={days === r}
                            onClick={() => setDays(r)}
                            className={cn(
                                "rounded px-2 py-1 transition-colors",
                                days === r
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {r}d
                        </button>
                    ))}
                </div>
            </div>

            {stats.isLoading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
            ) : stats.isError ? (
                <p className="text-sm text-destructive">{stats.error.message || "Could not load analytics."}</p>
            ) : !data || data.totalViews === 0 ? (
                <p className="rounded-md bg-muted/50 py-6 text-center text-sm text-muted-foreground">
                    No visits yet — share your link!
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Views" value={data.totalViews} />
                        <StatTile
                            label="Visitors"
                            value={data.uniqueVisitors}
                            hint="Unique visitors per day, summed over the range"
                        />
                    </div>

                    <DailyBars points={data.perDay} />

                    <div className="grid gap-3">
                        <TopList
                            title="Pages"
                            rows={data.topPages.map((p) => ({ key: p.path, label: p.path, views: p.views }))}
                        />
                        <TopList
                            title="Countries"
                            rows={data.topCountries.map((c) => ({
                                key: c.country,
                                label: `${countryFlag(c.country)} ${countryName(c.country)}`.trim(),
                                views: c.views,
                            }))}
                        />
                        <TopList
                            title="Referrers"
                            rows={data.topReferrers.map((r) => ({ key: r.host, label: r.host, views: r.views }))}
                            emptyLabel="Direct / none"
                        />
                    </div>
                </>
            )}
        </section>
    );
}

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
    return (
        <div className="rounded-md border bg-muted/30 px-3 py-2" title={hint}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{formatNumber(value)}</p>
        </div>
    );
}

function DailyBars({ points }: { points: DailyPoint[] }) {
    const max = Math.max(1, ...points.map((p) => p.views));
    const first = points[0];
    const last = points[points.length - 1];
    return (
        <div className="grid gap-1">
            <div
                className={cn("flex h-24 items-end", points.length > 30 ? "gap-px" : "gap-0.5")}
                role="img"
                aria-label={`Daily views from ${first ? formatDay(first.date) : ""} to ${last ? formatDay(last.date) : ""}`}
            >
                {points.map((p) => (
                    <div
                        key={p.date}
                        className="group relative flex h-full flex-1 items-end min-w-0"
                        title={`${formatDay(p.date)}: ${formatNumber(p.views)} views, ${formatNumber(p.visitors)} visitors`}
                    >
                        <div
                            className={cn(
                                "w-full rounded-t-sm transition-colors",
                                p.views > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-muted"
                            )}
                            style={{ height: p.views > 0 ? `${Math.max(4, (p.views / max) * 100)}%` : "2px" }}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{first ? formatDay(first.date) : ""}</span>
                <span>max {formatNumber(max)}/day</span>
                <span>{last ? formatDay(last.date) : ""}</span>
            </div>
        </div>
    );
}

function TopList({
    title,
    rows,
    emptyLabel = "No data",
}: {
    title: string;
    rows: { key: string; label: string; views: number }[];
    emptyLabel?: string;
}) {
    const max = Math.max(1, ...rows.map((r) => r.views));
    return (
        <div className="grid content-start gap-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">{emptyLabel}</p>
            ) : (
                <ul className="grid gap-0.5">
                    {rows.map((r) => (
                        <li key={r.key} className="relative flex items-center gap-2 rounded px-1.5 py-0.5 text-xs min-w-0">
                            <span
                                aria-hidden
                                className="absolute inset-y-0 left-0 rounded bg-primary/10"
                                style={{ width: `${(r.views / max) * 100}%` }}
                            />
                            <span className="relative flex-1 truncate" title={r.label}>
                                {r.label}
                            </span>
                            <span className="relative tabular-nums text-muted-foreground">{formatNumber(r.views)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
