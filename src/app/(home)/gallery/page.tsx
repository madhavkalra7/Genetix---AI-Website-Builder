"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ExternalLinkIcon,
    GitForkIcon,
    Loader2Icon,
    SearchIcon,
    SparklesIcon,
    XIcon,
} from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 12;

const TECH_LABELS: Record<string, string> = {
    "html-css-js": "HTML/CSS/JS",
    "react-nextjs": "Next.js",
    "vue-nuxt": "Vue",
    angular: "Angular",
    "svelte-kit": "Svelte",
};

function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

interface GallerySite {
    slug: string;
    title: string;
    url: string;
    techStack: string;
    remixCount: number;
    updatedAt: Date;
    author: string;
}

function SitePreview({ url, title }: { url: string; title: string }) {
    return (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/5">
            {/* Live, non-interactive thumbnail: render at 4x size and scale down to 25% */}
            <iframe
                src={url}
                title={`Preview of ${title}`}
                sandbox="allow-scripts"
                loading="lazy"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left border-0 bg-white"
                style={{ transform: "scale(0.25)" }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
    );
}

function GalleryCard({
    site,
    onRemix,
    remixing,
    disabled,
}: {
    site: GallerySite;
    onRemix: () => void;
    remixing: boolean;
    disabled: boolean;
}) {
    return (
        <article className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label={`Open ${site.title}`}
            >
                <SitePreview url={site.url} title={site.title} />
            </a>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white" title={site.title}>
                        {site.title}
                    </h3>
                    <p className="truncate text-xs text-gray-400">by {site.author}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-purple-200">
                        {TECH_LABELS[site.techStack] ?? site.techStack}
                    </span>
                    <span className="flex items-center gap-1" title="Remixes">
                        <GitForkIcon className="size-3.5" />
                        {site.remixCount.toLocaleString()}
                    </span>
                </div>
                <div className="mt-auto flex gap-2">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                        <a href={site.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon />
                            Open
                        </a>
                    </Button>
                    <Button
                        variant="venom"
                        size="sm"
                        className="flex-1"
                        onClick={onRemix}
                        disabled={disabled}
                    >
                        {remixing ? <Loader2Icon className="animate-spin" /> : <GitForkIcon />}
                        Remix
                    </Button>
                </div>
            </div>
        </article>
    );
}

export default function GalleryPage() {
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user: customAuthUser } = useAuth();
    const { data: session } = useSession();
    const isLoggedIn = !!(customAuthUser || session?.user);

    const [search, setSearch] = useState("");
    const [focused, setFocused] = useState(false);
    const q = useDebounced(search.trim());
    const [remixingSlug, setRemixingSlug] = useState<string | null>(null);

    const sites = useInfiniteQuery(
        trpc.gallery.list.infiniteQueryOptions(
            { limit: PAGE_SIZE, q: q || undefined },
            { getNextPageParam: (last) => last.nextCursor ?? undefined }
        )
    );
    const items = sites.data?.pages.flatMap((p) => p.items) ?? [];

    const remix = useMutation(
        trpc.gallery.remix.mutationOptions({
            onSuccess: async ({ projectId }) => {
                toast.success("Remix created", { description: "Opening your copy..." });
                await queryClient.invalidateQueries(trpc.projects.getMany.queryFilter());
                router.push(`/projects/${projectId}`);
            },
            onError: (error) => {
                setRemixingSlug(null);
                if (error.data?.code === "UNAUTHORIZED") {
                    router.push("/auth/signin?redirect=/gallery");
                    return;
                }
                toast.error(error.message || "Could not remix this site");
            },
        })
    );

    const handleRemix = (slug: string) => {
        if (!isLoggedIn) {
            router.push("/auth/signin?redirect=/gallery");
            return;
        }
        setRemixingSlug(slug);
        remix.mutate({ slug });
    };

    return (
        <div className="min-h-screen bg-black pt-16 text-white">
            {/* Hero */}
            <section className="relative overflow-hidden border-b border-white/10">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_60%)]" />
                <div className="relative mx-auto max-w-7xl px-4 py-12 text-center sm:py-16">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
                        <SparklesIcon className="size-3.5" />
                        Community gallery
                    </span>
                    <h1 className="mt-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text font-[Orbitron] text-3xl font-bold text-transparent sm:text-5xl">
                        Made with Genetix
                    </h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm text-gray-400 sm:text-base">
                        Explore sites the community has built and published. Remix any of them into your
                        own project and make it yours.
                    </p>

                    <div className="relative mx-auto mt-8 w-full max-w-2xl">
                        <div
                            className={cn(
                                "flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 transition-all duration-300",
                                focused
                                    ? "border-purple-500/50 bg-white/10 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                                    : "hover:border-white/20"
                            )}
                        >
                            <SearchIcon
                                className={cn("size-5 shrink-0", focused ? "text-purple-400" : "text-gray-400")}
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                placeholder="Search sites by title..."
                                maxLength={100}
                                aria-label="Search the gallery"
                                className="flex-1 border-none bg-transparent text-sm text-white outline-none placeholder:text-gray-500 sm:text-base [&::-webkit-search-cancel-button]:hidden"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="text-gray-400 transition-colors hover:text-white"
                                    aria-label="Clear search"
                                >
                                    <XIcon className="size-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Grid */}
            <section className="mx-auto max-w-7xl px-4 py-10">
                {sites.isLoading ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                            >
                                <div className="aspect-[16/10] animate-pulse bg-white/5" />
                                <div className="space-y-2 p-4">
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : sites.isError ? (
                    <div className="py-20 text-center">
                        <p className="text-sm text-red-400">
                            {sites.error.message || "Could not load the gallery."}
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                            onClick={() => sites.refetch()}
                        >
                            Try again
                        </Button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="mx-auto max-w-md py-20 text-center">
                        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                            <SparklesIcon className="size-6 text-purple-300" />
                        </div>
                        <h2 className="text-lg font-semibold">
                            {q ? `No sites match "${q}"` : "No sites in the gallery yet"}
                        </h2>
                        <p className="mt-2 text-sm text-gray-400">
                            {q
                                ? "Try a different search."
                                : 'Publish a site and switch on "Show in the Genetix community gallery" to be the first.'}
                        </p>
                        {!q && (
                            <Button variant="venom" size="sm" asChild className="mt-6 px-5">
                                <Link href="/">Start building</Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((site) => (
                                <GalleryCard
                                    key={site.slug}
                                    site={site}
                                    onRemix={() => handleRemix(site.slug)}
                                    remixing={remixingSlug === site.slug}
                                    disabled={remix.isPending}
                                />
                            ))}
                        </div>
                        {sites.hasNextPage && (
                            <div className="mt-10 flex justify-center">
                                <Button
                                    variant="outline"
                                    className="border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                                    onClick={() => sites.fetchNextPage()}
                                    disabled={sites.isFetchingNextPage}
                                >
                                    {sites.isFetchingNextPage && <Loader2Icon className="animate-spin" />}
                                    Load more
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
