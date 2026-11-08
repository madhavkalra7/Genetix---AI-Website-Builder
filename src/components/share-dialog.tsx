"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, ExternalLinkIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface ShareDialogProps {
    projectId: string;
    projectName: string;
    className?: string;
}

const shareText = (name: string) => `Check out "${name}" — I built it with Genetix. View it live or remix your own copy:`;

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.46 9.48-9.46a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46m8.06-17.52A11.32 11.32 0 0 0 12.04.65C5.77.65.66 5.75.66 12.03c0 2 .52 3.96 1.52 5.69L.57 23.6l6.02-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.05" />
        </svg>
    );
}

function XLogoIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
            <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
        </svg>
    );
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
        </svg>
    );
}

export function ShareDialog({ projectId, projectName, className }: ShareDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [canNativeShare, setCanNativeShare] = useState(false);

    useEffect(() => {
        setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    }, []);

    const shareQuery = useQuery({
        ...trpc.share.get.queryOptions({ projectId }),
        enabled: open,
    });
    const share = shareQuery.data;

    const setEnabled = useMutation(
        trpc.share.setEnabled.mutationOptions({
            onSuccess: (data) => {
                queryClient.setQueryData(trpc.share.get.queryKey({ projectId }), data);
                toast.success(data.enabled ? "Share link is on" : "Share link turned off", {
                    description: data.enabled
                        ? "Anyone with the link can view and remix this project."
                        : "The link now shows a not-found page. Turn it back on any time.",
                });
            },
            onError: (error) => toast.error(error.message || "Could not update sharing"),
        })
    );

    const url = share?.enabled ? share.url : null;
    const text = shareText(projectName);

    const handleCopy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copied");
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Could not copy the link");
        }
    };

    const handleNativeShare = async () => {
        if (!url) return;
        try {
            await navigator.share({ title: projectName, text, url });
        } catch (error) {
            // AbortError = the user closed the share sheet; not worth a toast.
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                toast.error("Could not open the share sheet");
            }
        }
    };

    const intents = url
        ? [
              {
                  label: "WhatsApp",
                  icon: WhatsAppIcon,
                  href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
                  className: "hover:text-[#25D366] hover:border-[#25D366]/50",
              },
              {
                  label: "X",
                  icon: XLogoIcon,
                  href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                  className: "hover:border-foreground/40",
              },
              {
                  label: "LinkedIn",
                  icon: LinkedInIcon,
                  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
                  className: "hover:text-[#0A66C2] hover:border-[#0A66C2]/50",
              },
          ]
        : [];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("shrink-0", className)}
                    aria-label="Share"
                    title="Share"
                >
                    <Share2Icon />
                    <span className="hidden sm:inline">Share</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share your project</DialogTitle>
                    <DialogDescription>
                        Send a link to the latest version. Viewers see it live and can remix their own copy.
                    </DialogDescription>
                </DialogHeader>

                {shareQuery.isLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                    </div>
                ) : shareQuery.isError ? (
                    <p className="text-sm text-destructive">
                        {shareQuery.error.message || "Could not load sharing settings."}
                    </p>
                ) : (
                    <div className="grid gap-4 min-w-0">
                        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                            <div className="grid gap-0.5 min-w-0">
                                <Label htmlFor="share-enabled">Anyone with the link can view and remix</Label>
                                <p className="text-xs text-muted-foreground">
                                    Your chat history and account details stay private.
                                </p>
                            </div>
                            <Switch
                                id="share-enabled"
                                checked={!!share?.enabled}
                                onCheckedChange={(enabled) => setEnabled.mutate({ projectId, enabled })}
                                disabled={setEnabled.isPending}
                                className="mt-0.5"
                            />
                        </div>

                        {url && (
                            <>
                                <div className="grid gap-1.5 min-w-0">
                                    <Label>Share link</Label>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <button
                                            type="button"
                                            onClick={handleCopy}
                                            className="flex-1 min-w-0 truncate rounded-md border bg-muted/40 px-3 py-1.5 text-left text-sm text-primary hover:bg-muted/70"
                                            title={url}
                                        >
                                            {url}
                                        </button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="size-8 shrink-0"
                                            onClick={handleCopy}
                                            aria-label="Copy link"
                                            title="Copy link"
                                        >
                                            {copied ? <CheckIcon /> : <CopyIcon />}
                                        </Button>
                                        <Button asChild variant="outline" size="icon" className="size-8 shrink-0">
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="Open share page"
                                                title="Open share page"
                                            >
                                                <ExternalLinkIcon />
                                            </a>
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label>Share to</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {intents.map(({ label, icon: Icon, href, className: hover }) => (
                                            <Button
                                                key={label}
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className={cn("transition-colors", hover)}
                                            >
                                                <a href={href} target="_blank" rel="noopener noreferrer">
                                                    <Icon className="size-4" />
                                                    {label}
                                                </a>
                                            </Button>
                                        ))}
                                        {canNativeShare && (
                                            <Button type="button" variant="outline" size="sm" onClick={handleNativeShare}>
                                                <Share2Icon />
                                                More…
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
