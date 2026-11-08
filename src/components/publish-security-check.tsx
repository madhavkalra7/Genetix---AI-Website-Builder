"use client";

// Security scan shown inside the Publish dialog (like Lovable's pre-publish scan).
// Scans the latest version's files in the browser; "Fix with AI" sends a fast quick edit.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { SecurityScanPanel } from "@/components/security-scan-panel";

export function PublishSecurityCheck({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: messages } = useQuery(trpc.messages.getMany.queryOptions({ projectId }));

  // Latest version = newest ASSISTANT message with a fragment
  const files = useMemo(() => {
    const withFragment = (messages ?? []).filter((m) => m.role === "ASSISTANT" && m.fragments);
    const latest = withFragment[withFragment.length - 1];
    const raw = latest?.fragments?.files;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, string>) : null;
  }, [messages]);

  const fix = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: () => {
        toast.success("Fixing security issues — this takes a few seconds");
        queryClient.invalidateQueries(trpc.messages.getMany.queryFilter({ projectId }));
      },
      onError: (e) => toast.error(e.message),
    })
  );

  if (!files) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Security check before publishing</p>
      <SecurityScanPanel
        files={files}
        fixPending={fix.isPending}
        onFixWithAi={(request) => fix.mutate({ projectId, value: request, mode: "quick" })}
      />
    </div>
  );
}
