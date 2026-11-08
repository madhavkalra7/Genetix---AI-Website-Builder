"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

type BuildEvent = { at: string; stage: string; detail?: string };

/** A build started this long before the triggering message still counts as "this run" (clock skew). */
const START_TOLERANCE_MS = 15_000;
/** Only the most recent completed steps are listed; older ones collapse into a counter. */
const MAX_VISIBLE_DONE = 6;

const humanize = (stage: string) => {
    const text = stage.replace(/[-_]+/g, " ").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Working";
};

const pluralIssues = (n: number) => `${n} issue${n === 1 ? "" : "s"}`;

/** Friendly label for a stage. `active` = in progress (ends with an ellipsis). */
export function stageLabel(stage: string, detail: string | undefined, qaIssues: number, active: boolean): string {
    const dots = active ? "…" : "";
    switch (stage) {
        case "starting":
            return active ? "Getting started…" : "Started";
        case "searching":
            return `${active ? "Searching" : "Searched"} the web${dots}`;
        case "planning":
            return `${active ? "Planning" : "Planned"} the build${dots}`;
        case "writing":
            return detail ? `${active ? "Writing" : "Wrote"} ${detail}${dots}` : `${active ? "Writing" : "Wrote"} code${dots}`;
        case "editing":
            return detail ? `${active ? "Editing" : "Edited"} ${detail}${dots}` : `${active ? "Editing" : "Edited"} code${dots}`;
        case "checking":
            return active ? "Running automated QA…" : "Automated QA";
        case "fixing":
            if (qaIssues > 0) {
                return active
                    ? `Automated QA found ${pluralIssues(qaIssues)} — fixing…`
                    : `Fixed ${pluralIssues(qaIssues)} found by QA`;
            }
            return active ? "Fixing issues…" : "Fixed issues";
        case "reviewing":
            return active ? "Reviewer is checking your code…" : "Code review";
        case "browser-testing":
            return active ? "Testing in a real browser…" : "Tested in a real browser";
        case "design-review":
            return active ? "Reviewing the design…" : "Design review";
        case "saving":
            return active ? "Saving…" : "Saved";
        case "done":
            return "Done";
        case "failed":
            return "Build failed";
        default:
            return humanize(stage) + dots;
    }
}

/** Detail is shown under the label unless the label already contains it. */
const showDetail = (stage: string, detail?: string) => !!detail && stage !== "writing" && stage !== "editing";

const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
};

const offsetLabel = (at: string, start: number) => {
    const t = Date.parse(at);
    if (!Number.isFinite(t)) return "";
    return `+${formatDuration(t - start)}`;
};

interface BuildProgressProps {
    projectId: string;
    isApp?: boolean;
    /** When the run we're waiting for was requested (the USER message's createdAt). */
    since?: Date | string | number | null;
    /** Rendered while no build row for this run exists yet (e.g. the pipeline hasn't started). */
    fallback?: ReactNode;
    className?: string;
}

export function BuildProgress({ projectId, isApp = false, since, fallback, className }: BuildProgressProps) {
    const trpc = useTRPC();
    const sinceMs = since ? new Date(since).getTime() : null;

    const { data: build } = useQuery(
        trpc.builds.getLatest.queryOptions(
            { projectId, isApp },
            {
                // Mounted only while waiting for a reply: keep polling until the run finishes
                refetchInterval: (query) => {
                    const latest = query.state.data;
                    if (query.state.error) return 5000;
                    if (!latest || latest.status === "running") return 1500;
                    // A finished build that predates this request: still waiting for the new one
                    if (sinceMs && new Date(latest.startedAt).getTime() < sinceMs - START_TOLERANCE_MS) return 1500;
                    return false;
                },
                refetchIntervalInBackground: false,
                retry: 1,
            },
        ),
    );

    const isCurrent =
        !!build && (!sinceMs || new Date(build.startedAt).getTime() >= sinceMs - START_TOLERANCE_MS);

    // 1s ticker for the elapsed time
    const [now, setNow] = useState(() => Date.now());
    const running = !isCurrent || build?.status === "running";
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [running]);

    const view = useMemo(() => {
        if (!build || !isCurrent) return null;
        const events: BuildEvent[] = build.events.length
            ? build.events
            : [{ at: new Date(build.startedAt).toISOString(), stage: build.stage }];
        const status = build.status;
        const last = events[events.length - 1];
        // The pipeline may bump `stage` before appending an event
        const current: BuildEvent =
            status === "running" && build.stage && build.stage !== last.stage
                ? { at: new Date().toISOString(), stage: build.stage }
                : last;
        const done = current === last ? events.slice(0, -1) : events;
        return { status, current, done };
    }, [build, isCurrent]);

    if (!view || !build) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className={cn("rounded-lg border bg-muted/40 p-3 text-sm", className)} role="status" aria-live="polite">
                <div className="flex items-center gap-2 min-w-0">
                    <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                    <span className="flex-1 min-w-0 truncate">Getting started…</span>
                    {sinceMs && (
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {formatDuration(now - sinceMs)}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    const start = new Date(build.startedAt).getTime();
    const end = build.finishedAt ? new Date(build.finishedAt).getTime() : now;
    const failed = view.status === "failed" || view.current.stage === "failed";
    const finished = view.status !== "running";
    const hiddenCount = Math.max(0, view.done.length - MAX_VISIBLE_DONE);
    const visibleDone = view.done.slice(hiddenCount);

    const currentLabel = failed
        ? "Build failed"
        : finished
          ? "Finishing up…"
          : stageLabel(view.current.stage, view.current.detail, build.qaIssues, true);

    return (
        <div
            className={cn("rounded-lg border bg-muted/40 p-3 text-sm min-w-0", className)}
            role="status"
            aria-live="polite"
            aria-label="Build progress"
        >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/60">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {failed ? "Build stopped" : finished ? "Build complete" : "Building"}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground" title="Elapsed time">
                    {formatDuration(end - start)}
                </span>
            </div>

            <ol className="flex flex-col gap-1.5">
                {hiddenCount > 0 && (
                    <li className="pl-6 text-xs text-muted-foreground">
                        {hiddenCount} earlier step{hiddenCount === 1 ? "" : "s"}
                    </li>
                )}
                {visibleDone.map((event, i) => (
                    <li key={`${event.at}-${i}`} className="flex items-start gap-2 min-w-0 text-muted-foreground">
                        <CheckIcon className="size-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden />
                        <div className="flex-1 min-w-0">
                            <div className="truncate">{stageLabel(event.stage, event.detail, build.qaIssues, false)}</div>
                            {showDetail(event.stage, event.detail) && (
                                <div className="truncate text-xs opacity-80">{event.detail}</div>
                            )}
                        </div>
                        <span className="shrink-0 tabular-nums text-xs opacity-70">{offsetLabel(event.at, start)}</span>
                    </li>
                ))}
                <li className="flex items-start gap-2 min-w-0 font-medium">
                    {failed ? (
                        <XIcon className="size-4 shrink-0 mt-0.5 text-red-500" aria-hidden />
                    ) : (
                        <Loader2Icon className="size-4 shrink-0 mt-0.5 animate-spin text-primary" aria-hidden />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="[overflow-wrap:anywhere]">{currentLabel}</div>
                        {!failed && !finished && showDetail(view.current.stage, view.current.detail) && (
                            <div className="truncate text-xs font-normal text-muted-foreground">{view.current.detail}</div>
                        )}
                    </div>
                </li>
            </ol>
        </div>
    );
}
