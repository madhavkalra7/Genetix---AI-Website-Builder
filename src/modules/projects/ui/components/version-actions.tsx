"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyIcon, GitCompareIcon, HistoryIcon, Loader2Icon, MoreHorizontalIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VersionCompareDialog } from "./version-compare-dialog";

/** Duplicate the project's latest version into a new project and open it. */
export function useDuplicateProject(projectId: string) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();
    return useMutation(
        trpc.fragments.duplicateProject.mutationOptions({
            onSuccess: (data) => {
                toast.success("Project duplicated");
                queryClient.invalidateQueries(trpc.projects.getMany.queryFilter());
                router.push(`/projects/${data.id}`);
            },
            onError: (error) => {
                toast.error(error.message || "Couldn't duplicate the project");
            },
        }),
    );
}

interface VersionActionsProps {
    projectId: string;
    fragmentId: string;
    /** Latest version in this project (compare target); null when unknown */
    latestFragmentId: string | null;
    /** A build is running: restoring now would race with it */
    isBuilding?: boolean;
    className?: string;
}

export function VersionActions({
    projectId,
    fragmentId,
    latestFragmentId,
    isBuilding = false,
    className,
}: VersionActionsProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [compareOpen, setCompareOpen] = useState(false);

    const restore = useMutation(
        trpc.fragments.restore.mutationOptions({
            onSuccess: () => {
                toast.success("Version restored");
                queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
            },
            onError: (error) => {
                toast.error(error.message || "Couldn't restore this version");
            },
        }),
    );
    const duplicate = useDuplicateProject(projectId);

    const isLatest = !latestFragmentId || latestFragmentId === fragmentId;
    const busy = restore.isPending || duplicate.isPending;

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Version actions"
                        className={cn("size-8 shrink-0", className)}
                        disabled={busy}
                    >
                        {busy ? <Loader2Icon className="animate-spin" /> : <MoreHorizontalIcon />}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem
                        disabled={isLatest || isBuilding || restore.isPending}
                        onSelect={() => restore.mutate({ fragmentId })}
                    >
                        <HistoryIcon />
                        <span>{isBuilding ? "Restore (wait for build)" : "Restore this version"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isLatest} onSelect={() => setCompareOpen(true)}>
                        <GitCompareIcon />
                        <span>Compare with latest</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={duplicate.isPending}
                        onSelect={() => duplicate.mutate({ projectId })}
                    >
                        <CopyIcon />
                        <span>Duplicate project</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {latestFragmentId && !isLatest && (
                <VersionCompareDialog
                    open={compareOpen}
                    onOpenChange={setCompareOpen}
                    fromFragmentId={fragmentId}
                    toFragmentId={latestFragmentId}
                />
            )}
        </>
    );
}
