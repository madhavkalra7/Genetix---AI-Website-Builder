"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GitForkIcon, Loader2Icon, MonitorSmartphoneIcon, WandSparklesIcon } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SandboxedPreview } from "@/modules/share/ui/sandboxed-preview";
import { hasStaticEntry } from "@/lib/static-html";
import { sharePath } from "@/modules/share/shared";

interface ShareViewProps {
    shareId: string;
    projectName: string;
    author: string;
    techStack: string;
    files: Record<string, string>;
    hasVersion: boolean;
}

export function ShareView({ shareId, projectName, author, techStack, files, hasVersion }: ShareViewProps) {
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, loading: authLoading } = useAuth();
    const { data: session, status: sessionStatus } = useSession();
    const isLoggedIn = !!(user || session?.user);
    const signInUrl = `/auth/signin?redirect=${encodeURIComponent(sharePath(shareId))}`;

    const remix = useMutation(
        trpc.share.remix.mutationOptions({
            onSuccess: async ({ projectId }) => {
                toast.success("Remix created", { description: "Opening your copy..." });
                await queryClient.invalidateQueries(trpc.projects.getMany.queryFilter());
                router.push(`/projects/${projectId}`);
            },
            onError: (error) => {
                if (error.data?.code === "UNAUTHORIZED") {
                    router.push(signInUrl);
                    return;
                }
                toast.error(error.message || "Could not remix this project");
            },
        })
    );

    const handleRemix = () => {
        // Auth state still resolving: let the server decide (UNAUTHORIZED redirects to sign-in).
        if (!isLoggedIn && !authLoading && sessionStatus !== "loading") {
            router.push(signInUrl);
            return;
        }
        remix.mutate({ shareId });
    };

    const isStatic = hasStaticEntry(files);
    const remixBusy = remix.isPending || remix.isSuccess;

    return (
        <div className="fixed inset-0 flex flex-col bg-neutral-950 text-white">
            <header className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-white/10 bg-black/80 backdrop-blur-xl">
                <Link href="/" className="flex items-center gap-2 shrink-0 group" aria-label="Genetix home">
                    <Image
                        src="/logo.png"
                        alt="Genetix"
                        width={24}
                        height={24}
                        className="transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]"
                    />
                    <span className="hidden md:inline font-semibold">Genetix</span>
                </Link>
                <span className="hidden md:block h-5 w-px bg-white/15" aria-hidden />
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm sm:text-base font-semibold" title={projectName}>
                        {projectName}
                    </h1>
                    <p className="truncate text-xs text-white/55">by {author}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="bg-white/5 border-white/20 text-white hover:bg-white/15 hover:text-white"
                    >
                        <Link href="/" aria-label="Build your own" title="Build your own">
                            <WandSparklesIcon />
                            <span className="hidden sm:inline">Build your own</span>
                        </Link>
                    </Button>
                    <Button
                        variant="venom"
                        size="sm"
                        onClick={handleRemix}
                        disabled={remixBusy || !hasVersion}
                        title={hasVersion ? "Copy this project into your account" : "Nothing to remix yet"}
                    >
                        {remixBusy ? <Loader2Icon className="animate-spin" /> : <GitForkIcon />}
                        <span className="hidden sm:inline">Remix this project</span>
                        <span className="sm:hidden">Remix</span>
                    </Button>
                </div>
            </header>

            <main className="relative flex-1 min-h-0">
                {isStatic ? (
                    <div className="absolute inset-0 bg-white">
                        <SandboxedPreview files={files} title={projectName} className="w-full h-full border-0" />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.25),transparent_60%)]">
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-purple-900/20 backdrop-blur">
                            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-purple-500/15 border border-purple-400/30">
                                <MonitorSmartphoneIcon className="size-7 text-purple-300" />
                            </div>
                            <h2 className="text-lg font-semibold font-[Orbitron]">
                                {hasVersion ? "Preview available for static projects" : "Nothing to preview yet"}
                            </h2>
                            <p className="mt-2 text-sm text-white/60">
                                {hasVersion
                                    ? `This project uses ${techStack}, which needs a live server to run. Remix it to open your own copy in Genetix and see it in action.`
                                    : "The owner hasn't generated a version of this project yet. Check back soon!"}
                            </p>
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
                                {hasVersion && (
                                    <Button variant="venom" onClick={handleRemix} disabled={remixBusy}>
                                        {remixBusy ? <Loader2Icon className="animate-spin" /> : <GitForkIcon />}
                                        Remix this project
                                    </Button>
                                )}
                                <Button
                                    asChild
                                    variant="outline"
                                    className="bg-white/5 border-white/20 text-white hover:bg-white/15 hover:text-white"
                                >
                                    <Link href="/">Build your own</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
