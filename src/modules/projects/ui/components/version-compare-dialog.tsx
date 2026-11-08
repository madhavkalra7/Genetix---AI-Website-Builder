"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fromFragmentId: string;
    toFragmentId: string;
}

const STATUS_STYLES: Record<string, string> = {
    added: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    removed: "bg-red-500/15 text-red-600 dark:text-red-400",
    modified: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const countChanges = (diff?: string[]) => {
    let added = 0;
    let removed = 0;
    for (const line of diff ?? []) {
        if (line.startsWith("@@")) continue;
        if (line.startsWith("+")) added++;
        else if (line.startsWith("-")) removed++;
    }
    return { added, removed };
};

function DiffBlock({ lines }: { lines: string[] }) {
    return (
        <div className="overflow-x-auto rounded-md border bg-muted/30">
            <pre className="min-w-fit py-1 font-mono text-[11px] leading-5 sm:text-xs">
                {lines.map((line, i) => {
                    const kind = line.startsWith("@@") ? "hunk" : line[0];
                    return (
                        <div
                            key={i}
                            className={cn(
                                "px-3 whitespace-pre",
                                kind === "+" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                kind === "-" && "bg-red-500/15 text-red-700 dark:text-red-300",
                                kind === "hunk" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                            )}
                        >
                            {kind === "hunk" ? line : `${line[0] ?? " "} ${line.slice(1)}`}
                        </div>
                    );
                })}
            </pre>
        </div>
    );
}

export function VersionCompareDialog({ open, onOpenChange, fromFragmentId, toFragmentId }: Props) {
    const trpc = useTRPC();
    const { data, isLoading, error } = useQuery(
        trpc.fragments.compare.queryOptions(
            { fromFragmentId, toFragmentId },
            { enabled: open, staleTime: 30_000 },
        ),
    );

    const changed = data?.files.filter((f) => f.status !== "unchanged") ?? [];
    const unchangedCount = (data?.files.length ?? 0) - changed.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[85dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-3 p-4 sm:max-w-4xl sm:p-6">
                <DialogHeader className="pr-6 text-left">
                    <DialogTitle>Compare versions</DialogTitle>
                    <DialogDescription className="break-words [overflow-wrap:anywhere]">
                        {data ? (
                            <>
                                <span className="font-medium text-foreground">{data.from.title}</span>
                                {" → "}
                                <span className="font-medium text-foreground">{data.to.title}</span>
                                <span className="text-muted-foreground"> (latest)</span>
                            </>
                        ) : (
                            "Changes from this version to the latest one"
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {isLoading && (
                        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" aria-hidden /> Comparing…
                        </div>
                    )}
                    {error && <p className="text-sm text-red-500">{error.message}</p>}
                    {data && changed.length === 0 && (
                        <p className="text-sm text-muted-foreground">These versions are identical.</p>
                    )}
                    {data && changed.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-muted-foreground">
                                {changed.length} file{changed.length === 1 ? "" : "s"} changed
                                {unchangedCount > 0 && ` · ${unchangedCount} unchanged`}
                            </p>
                            {changed.map((file) => {
                                const { added, removed } = countChanges(file.diff);
                                return (
                                    <details
                                        key={file.path}
                                        open={changed.length <= 4}
                                        className="group rounded-md border"
                                    >
                                        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                                            <span
                                                className={cn(
                                                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                                    STATUS_STYLES[file.status],
                                                )}
                                            >
                                                {file.status}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={file.path}>
                                                {file.path}
                                            </span>
                                            {file.diff ? (
                                                <span className="shrink-0 font-mono text-xs">
                                                    <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>{" "}
                                                    <span className="text-red-600 dark:text-red-400">-{removed}</span>
                                                </span>
                                            ) : null}
                                        </summary>
                                        <div className="px-2 pb-2">
                                            {file.diff && file.diff.length > 0 ? (
                                                <DiffBlock lines={file.diff} />
                                            ) : (
                                                <p className="px-1 text-xs text-muted-foreground">
                                                    {file.note ?? "No line changes to show"}
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
