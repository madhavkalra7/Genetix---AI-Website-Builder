"use client";

// One-click online multiplayer for games: sends a full build request (1 credit)
// that adds a PeerJS (WebRTC) lobby + host-authoritative netcode to the game.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, SwordsIcon, HeartHandshakeIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildMultiplayerRequest, type MultiplayerMaxPlayers, type MultiplayerMode } from "@/lib/feature-prompts";

interface MultiplayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSent?: () => void;
}

const MODES = [
  { value: "versus", label: "Versus", description: "Compete for the top score", Icon: SwordsIcon },
  { value: "coop", label: "Co-op", description: "Team up against the game", Icon: HeartHandshakeIcon },
] as const;

const PLAYER_COUNTS: MultiplayerMaxPlayers[] = [2, 3, 4];

export function MultiplayerDialog({ open, onOpenChange, projectId, onSent }: MultiplayerDialogProps) {
  const [mode, setMode] = useState<MultiplayerMode>("versus");
  const [maxPlayers, setMaxPlayers] = useState<MultiplayerMaxPlayers>(2);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: usage } = useQuery(trpc.usage.status.queryOptions());

  const createMessage = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
        queryClient.invalidateQueries(trpc.usage.status.queryOptions());
        toast.success("Adding online multiplayer — rebuilding");
        onOpenChange(false);
        onSent?.();
      },
      onError: (error) => {
        toast.error(error.message);
        if (error.data?.code === "TOO_MANY_REQUESTS" && !usage?.aiquestMode) {
          router.push("/pricing");
        }
      },
    }),
  );

  const submit = () => {
    if (createMessage.isPending) return;
    createMessage.mutate({ projectId, value: buildMultiplayerRequest({ mode, maxPlayers }) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-5 text-primary" aria-hidden />
            Make it multiplayer
          </DialogTitle>
          <DialogDescription>
            Friends join with a link — works across phones and laptops, no accounts needed. Single-player keeps working.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Mode</p>
            <div role="radiogroup" aria-label="Multiplayer mode" className="grid grid-cols-2 gap-2">
              {MODES.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  disabled={createMessage.isPending}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                    mode === value ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Max players</p>
            <div role="radiogroup" aria-label="Maximum players" className="flex gap-2">
              {PLAYER_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={maxPlayers === n}
                  onClick={() => setMaxPlayers(n)}
                  disabled={createMessage.isPending}
                  className={cn(
                    "h-9 flex-1 rounded-md border text-sm font-medium transition-colors disabled:opacity-60",
                    maxPlayers === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Uses peer-to-peer WebRTC: the host shares a room code, invite link or QR code. If online play can&apos;t connect,
            the game falls back to local play.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMessage.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createMessage.isPending}>
            {createMessage.isPending && <Loader2Icon className="size-4 animate-spin" />}
            Make it multiplayer (1 credit)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
