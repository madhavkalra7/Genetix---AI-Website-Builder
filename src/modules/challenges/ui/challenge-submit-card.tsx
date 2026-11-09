"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { formatTimeLeft } from "@/modules/challenges/shared";
import { useNow } from "./use-now";

/**
 * Compact "This week's challenge" card for the publish dialog. Render only when the project
 * is published; hides itself when no challenge is open.
 */
export function ChallengeSubmitCard({ projectId }: { projectId: string }) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const now = useNow(60_000);

    const status = useQuery(trpc.challenges.projectStatus.queryOptions({ projectId }));

    const refresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries(trpc.challenges.projectStatus.queryFilter({ projectId })),
            queryClient.invalidateQueries(trpc.challenges.current.queryFilter()),
            queryClient.invalidateQueries(trpc.challenges.leaderboard.queryFilter()),
            // Submitting turns on the gallery listing; resync the dialog's showcase toggle.
            queryClient.invalidateQueries(trpc.publish.get.queryFilter({ projectId })),
        ]);
    };

    const submit = useMutation(
        trpc.challenges.submit.mutationOptions({
            onSuccess: async (data) => {
                await refresh();
                toast.success("Entry submitted", {
                    description: `You're in "${data.title}". Share your link to climb the leaderboard!`,
                });
            },
            onError: (error) => toast.error(error.message || "Could not submit your entry"),
        })
    );
    const withdraw = useMutation(
        trpc.challenges.withdraw.mutationOptions({
            onSuccess: async () => {
                await refresh();
                toast.success("Entry withdrawn");
            },
            onError: (error) => toast.error(error.message || "Could not withdraw your entry"),
        })
    );

    const data = status.data;
    if (!data || !data.challenge.isOpen) return null;

    const msLeft = new Date(data.challenge.endsAt).getTime() - now;
    if (msLeft <= 0) return null;
    const busy = submit.isPending || withdraw.isPending;
    const atLimit = !data.submitted && data.userEntryCount >= data.maxEntries;

    return (
        <div className="grid gap-2 rounded-md border border-purple-500/30 bg-purple-500/5 p-3 min-w-0">
            <div className="flex items-start gap-2 min-w-0">
                <TrophyIcon className="mt-0.5 size-4 shrink-0 text-yellow-400" />
                <div className="grid gap-0.5 min-w-0">
                    <p className="text-sm font-medium truncate" title={data.challenge.title}>
                        This week: {data.challenge.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Ends in {formatTimeLeft(msLeft)} · 1st place wins {data.challenge.prizes[0]} credits ·{" "}
                        <Link href="/challenges" target="_blank" className="text-primary hover:underline">
                            Details
                        </Link>
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {data.submitted ? (
                    <>
                        <span className="flex items-center gap-1 text-sm font-medium text-emerald-500">
                            <CheckIcon className="size-4" />
                            Submitted
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => withdraw.mutate({ projectId })}
                            disabled={busy}
                        >
                            {withdraw.isPending && <Loader2Icon className="animate-spin" />}
                            Withdraw
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => submit.mutate({ projectId })}
                            disabled={busy || atLimit}
                        >
                            {submit.isPending ? <Loader2Icon className="animate-spin" /> : <TrophyIcon />}
                            Submit entry
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {atLimit
                                ? `You've used all ${data.maxEntries} entries`
                                : "Also lists it in the gallery"}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
