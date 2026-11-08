"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, ExternalLinkIcon, GlobeIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    NOT_PUBLISHABLE_MESSAGE,
    SLUG_MAX_LENGTH,
    isPublishableTechStack,
    slugifyName,
    validateSlug,
} from "@/modules/publish/shared";

interface PublishDialogProps {
    projectId: string;
    projectName: string;
    techStack: string;
    className?: string;
}

const suggestSlug = (name: string) => {
    const base = slugifyName(name) || "site";
    const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
    return `${base.length < 2 ? "site" : base}-${suffix}`;
};

export function PublishDialog({ projectId, projectName, techStack, className }: PublishDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [slug, setSlug] = useState("");
    const [copied, setCopied] = useState(false);

    const publishable = isPublishableTechStack(techStack);

    const siteQuery = useQuery({
        ...trpc.publish.get.queryOptions({ projectId }),
        enabled: open && publishable,
    });
    const site = siteQuery.data ?? null;

    // Prefill the address field whenever the dialog opens
    useEffect(() => {
        if (!open || siteQuery.isLoading) return;
        setSlug(site?.slug ?? suggestSlug(projectName));
    }, [open, siteQuery.isLoading, site?.slug]);

    const invalidate = () => queryClient.invalidateQueries(trpc.publish.get.queryFilter({ projectId }));

    const publish = useMutation(
        trpc.publish.publish.mutationOptions({
            onSuccess: async (data) => {
                await invalidate();
                toast.success(site ? "Site updated" : "Site published", {
                    description: data.url,
                    action: { label: "Open", onClick: () => window.open(data.url, "_blank", "noopener,noreferrer") },
                });
            },
            onError: (error) => toast.error(error.message || "Could not publish the site"),
        })
    );

    const unpublish = useMutation(
        trpc.publish.unpublish.mutationOptions({
            onSuccess: async () => {
                await invalidate();
                setSlug(suggestSlug(projectName));
                toast.success("Site unpublished");
            },
            onError: (error) => toast.error(error.message || "Could not unpublish the site"),
        })
    );

    const slugError = slug ? validateSlug(slug) : "Enter an address";
    const busy = publish.isPending || unpublish.isPending;

    const handlePublish = () => {
        if (slugError) {
            toast.error(slugError);
            return;
        }
        publish.mutate({ projectId, slug });
    };

    const handleCopy = async () => {
        if (!site) return;
        try {
            await navigator.clipboard.writeText(site.url);
            setCopied(true);
            toast.success("Link copied");
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Could not copy the link");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("shrink-0", className)}
                    aria-label="Publish"
                    title="Publish"
                >
                    <GlobeIcon />
                    <span className="hidden sm:inline">Publish</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Publish your site</DialogTitle>
                    <DialogDescription>
                        Get a public link anyone can visit. Republish any time to update it.
                    </DialogDescription>
                </DialogHeader>

                {!publishable ? (
                    <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
                        {NOT_PUBLISHABLE_MESSAGE}. Next.js projects need a server to run, so they
                        can&apos;t be published as a static site yet.
                    </p>
                ) : siteQuery.isLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                    </div>
                ) : siteQuery.isError ? (
                    <p className="text-sm text-destructive">
                        {siteQuery.error.message || "Could not load publishing status."}
                    </p>
                ) : (
                    <div className="grid gap-4 min-w-0">
                        {site && (
                            <div className="grid gap-1.5 min-w-0">
                                <Label>Live at</Label>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <a
                                        href={site.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 min-w-0 truncate rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-primary hover:underline"
                                        title={site.url}
                                    >
                                        {site.url}
                                    </a>
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
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="icon"
                                        className="size-8 shrink-0"
                                    >
                                        <a
                                            href={site.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Open site"
                                            title="Open site"
                                        >
                                            <ExternalLinkIcon />
                                        </a>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Last published {new Date(site.updatedAt).toLocaleString()}
                                </p>
                            </div>
                        )}

                        <div className="grid gap-1.5 min-w-0">
                            <Label htmlFor="publish-slug">Site address</Label>
                            <div className="flex items-center rounded-md border focus-within:ring-[3px] focus-within:ring-ring/50 min-w-0">
                                <span className="pl-3 text-sm text-muted-foreground shrink-0">/s/</span>
                                <Input
                                    id="publish-slug"
                                    value={slug}
                                    maxLength={SLUG_MAX_LENGTH}
                                    onChange={(e) =>
                                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handlePublish();
                                    }}
                                    className="border-0 shadow-none focus-visible:ring-0 pl-0.5 min-w-0"
                                    placeholder="my-site"
                                    autoComplete="off"
                                    spellCheck={false}
                                    aria-invalid={!!slugError}
                                    disabled={busy}
                                />
                            </div>
                            <p className={cn("text-xs", slugError ? "text-destructive" : "text-muted-foreground")}>
                                {slugError ?? "Lowercase letters, numbers and hyphens (3-40 characters)."}
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    {publishable && site && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-destructive hover:text-destructive sm:mr-auto"
                            onClick={() => unpublish.mutate({ projectId })}
                            disabled={busy}
                        >
                            {unpublish.isPending && <Loader2Icon className="animate-spin" />}
                            Unpublish
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={handlePublish}
                        disabled={!publishable || busy || siteQuery.isLoading || !!slugError}
                    >
                        {publish.isPending ? <Loader2Icon className="animate-spin" /> : <GlobeIcon />}
                        {site ? "Update" : "Publish latest version"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
