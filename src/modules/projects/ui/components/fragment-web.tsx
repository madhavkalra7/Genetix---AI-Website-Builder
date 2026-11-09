import { Fragment } from "@/generated/prisma";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, GaugeIcon, LanguagesIcon, MousePointerClickIcon, RefreshCcwIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HTMLPreview, type ElementStylePreview, type SelectedElementInfo } from "@/components/html-preview";
import { SiteAuditPanel } from "@/components/site-audit-panel";
import { SecurityScanPanel } from "@/components/security-scan-panel";
import { MultiplayerDialog } from "@/components/multiplayer-dialog";
import { TranslateDialog } from "@/components/translate-dialog";
import { hasStaticEntry } from "@/lib/static-html";
import { ElementEditPanel } from "./element-edit-panel";

interface Props {
    data: Fragment;
    /** Enables click-to-edit for static projects */
    projectId?: string;
    /** Called after a click-to-edit request was sent as a chat message */
    onEditSent?: () => void;
};

export function FragmentWeb({ data, projectId, onEditSent }: Props){
        const [copied, setCopied] = useState(false);
        const [fragmentKey, setFragmentKey] = useState(0);
        const [selectMode, setSelectMode] = useState(false);
        const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
        const [selectionKey, setSelectionKey] = useState(0);
        const [stylePreview, setStylePreview] = useState<ElementStylePreview | null>(null);
        const [auditOpen, setAuditOpen] = useState(false);
        const [securityOpen, setSecurityOpen] = useState(false);
        const [multiplayerOpen, setMultiplayerOpen] = useState(false);
        const [translateOpen, setTranslateOpen] = useState(false);

        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const router = useRouter();
        const { data: usage } = useQuery({ ...trpc.usage.status.queryOptions(), enabled: !!projectId });

        // One quick AI edit (audit / security fixes); same credit handling as the chat form
        const quickEdit = useMutation(
            trpc.messages.create.mutationOptions({
                onSuccess: () => {
                    if (projectId) {
                        queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
                    }
                    queryClient.invalidateQueries(trpc.usage.status.queryOptions());
                    toast.success("Fix requested — rebuilding");
                    setAuditOpen(false);
                    setSecurityOpen(false);
                    onEditSent?.();
                },
                onError: (error) => {
                    toast.error(error.message);
                    if (error.data?.code === "TOO_MANY_REQUESTS" && !usage?.aiquestMode) {
                        router.push("/pricing");
                    }
                },
            }),
        );
        const quickEditPending = quickEdit.isPending;
        const mutateQuickEdit = quickEdit.mutate;
        const sendQuickEdit = useCallback(
            (request: string) => {
                if (!projectId || !request || quickEditPending) return;
                mutateQuickEdit({ projectId, value: request, mode: "quick" });
            },
            [projectId, quickEditPending, mutateQuickEdit],
        );

        const exitSelectMode = useCallback(() => {
            setSelectMode(false);
            setSelectedElement(null);
            setStylePreview(null);
        }, []);

        const handleElementSelected = useCallback((info: SelectedElementInfo) => {
            setSelectedElement(info);
            setSelectionKey((k) => k + 1);
            setStylePreview(null);
        }, []);

        // A different version is shown: drop any selection made on the old one
        useEffect(() => {
            exitSelectMode();
        }, [data.id, exitSelectMode]);

        // Esc while focus is outside the preview iframe (inside it, the iframe reports it)
        useEffect(() => {
            if (!selectMode) return;
            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") exitSelectMode();
            };
            window.addEventListener("keydown", onKeyDown);
            return () => window.removeEventListener("keydown", onKeyDown);
        }, [selectMode, exitSelectMode]);

        const onRefresh = () => {
            setFragmentKey((prev) => prev + 1);
        };

        const handleCopy = async () => {
            if (!data.sandboxUrl) return;
            try {
                await navigator.clipboard.writeText(data.sandboxUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                toast.error("Couldn't copy the URL");
            }
        };

        // Full-screen preview is a real page opened with a normal link (never blocked as a pop-up)
        const fullScreenUrl = `/preview/web/${data.id}`;

        // Check if this is a static project that can be previewed locally
        const isStaticProject = hasStaticEntry(data.files);

        // Get project type for display
        const getProjectType = () => {
            if (!data.files || typeof data.files !== 'object') return 'Unknown';
            
            const files = data.files as {[path: string]: string};
            const fileNames = Object.keys(files);
            
            // Check for Vue/Nuxt
            if (fileNames.some(f => f.includes('nuxt') || f.includes('vue'))) {
                return 'Vue.js + Nuxt';
            }
            
            // Check for Angular
            if (fileNames.some(f => f.includes('angular') || f.includes('ng-'))) {
                return 'Angular';
            }
            
            // Check for Svelte
            if (fileNames.some(f => f.includes('svelte') || f.includes('_app'))) {
                return 'Svelte + SvelteKit';
            }
            
            // Default to HTML/CSS/JS
            return 'HTML/CSS/JS';
        };

        // If it's a static project, use our custom HTMLPreview component
        if (isStaticProject) {
            return (
                <div className="flex flex-col w-full h-full">
                    <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
                        <Hint text="Refresh" side="bottom" align="start">
                            <Button size="sm" variant="outline" onClick={onRefresh} aria-label="Refresh preview">
                                <RefreshCcwIcon/>
                            </Button>
                        </Hint>
                        {projectId && (
                            <Hint text="Select an element to edit" side="bottom" align="start">
                                <Button
                                    size="sm"
                                    variant={selectMode ? "default" : "outline"}
                                    aria-label="Select an element to edit"
                                    aria-pressed={selectMode}
                                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                                >
                                    <MousePointerClickIcon/>
                                </Button>
                            </Hint>
                        )}
                        <Hint text="SEO & accessibility audit" side="bottom" align="start">
                            <Button
                                size="sm"
                                variant="outline"
                                aria-label="SEO & accessibility audit"
                                onClick={() => setAuditOpen(true)}
                            >
                                <GaugeIcon/>
                            </Button>
                        </Hint>
                        <Hint text="Security scan" side="bottom" align="start">
                            <Button
                                size="sm"
                                variant="outline"
                                aria-label="Security scan"
                                onClick={() => setSecurityOpen(true)}
                            >
                                <ShieldCheckIcon/>
                            </Button>
                        </Hint>
                        {projectId && (
                            <>
                                <Hint text="Translate into Indian & world languages" side="bottom" align="start">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        aria-label="Translate into Indian & world languages"
                                        onClick={() => setTranslateOpen(true)}
                                    >
                                        <LanguagesIcon/>
                                    </Button>
                                </Hint>
                                <Hint text="Make it multiplayer" side="bottom" align="start">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        aria-label="Make it multiplayer"
                                        onClick={() => setMultiplayerOpen(true)}
                                    >
                                        <UsersIcon/>
                                    </Button>
                                </Hint>
                            </>
                        )}
                        <Hint text={`${getProjectType()} Preview`} side="bottom">
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1 justify-start text-start font-normal"
                                disabled
                            >
                                <span className="truncate">
                                    Static {getProjectType()} Preview
                                </span>
                            </Button>
                        </Hint>
                        <Hint text="Open in full screen" side="bottom" align="start">
                            <Button size="sm" variant="outline" asChild>
                                <a href={fullScreenUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in full screen">
                                    <ExternalLinkIcon/>
                                </a>
                            </Button>
                        </Hint>
                    </div>
                    <div className="relative flex-1">
                        <HTMLPreview 
                            key={fragmentKey}
                            files={data.files as {[path: string]: string}} 
                            className="w-full h-full"
                            selectMode={selectMode}
                            onElementSelected={projectId ? handleElementSelected : undefined}
                            onSelectModeExit={exitSelectMode}
                            stylePreview={stylePreview}
                        />
                        {projectId && selectMode && (
                            <ElementEditPanel
                                projectId={projectId}
                                fragmentId={data.id}
                                element={selectedElement}
                                selectionKey={selectionKey}
                                onCancel={exitSelectMode}
                                onSent={() => {
                                    exitSelectMode();
                                    onEditSent?.();
                                }}
                                onVisualSaved={exitSelectMode}
                                onPreviewChange={setStylePreview}
                            />
                        )}
                    </div>
                    <SiteAuditPanel
                        open={auditOpen}
                        onOpenChange={setAuditOpen}
                        files={data.files as {[path: string]: string}}
                        onFixWithAi={projectId ? sendQuickEdit : undefined}
                        fixPending={quickEditPending}
                    />
                    <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Security scan</DialogTitle>
                                <DialogDescription>
                                    Looks for exposed API keys, unsafe code and insecure links in this version.
                                </DialogDescription>
                            </DialogHeader>
                            {securityOpen && (
                                <SecurityScanPanel
                                    files={data.files as {[path: string]: string}}
                                    onFixWithAi={projectId ? sendQuickEdit : undefined}
                                    fixPending={quickEditPending}
                                />
                            )}
                        </DialogContent>
                    </Dialog>
                    {projectId && (
                        <>
                            <MultiplayerDialog
                                open={multiplayerOpen}
                                onOpenChange={setMultiplayerOpen}
                                projectId={projectId}
                                onSent={onEditSent}
                            />
                            <TranslateDialog
                                open={translateOpen}
                                onOpenChange={setTranslateOpen}
                                projectId={projectId}
                                onSent={onEditSent}
                            />
                        </>
                    )}
                </div>
            );
        }

        // For React/Next.js and other projects, use the regular iframe
        return (
            <div className="flex flex-col w-full h-full">
                <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
                    <Hint text="Refresh" side="bottom" align="start">
                        <Button size="sm" variant="outline" onClick={onRefresh}>
                            <RefreshCcwIcon/>
                        </Button>
                    </Hint>
                    <Hint text="Click to copy" side="bottom">
                    <Button size="sm" 
                        variant="outline" 
                        onClick={handleCopy}
                        disabled={!data.sandboxUrl || copied}
                        className="flex-1 justify-start text-start font-normal"
                    >
                        <span className="truncate">
                            {copied ? "Copied!" : data.sandboxUrl}
                        </span>
                    </Button>
                    </Hint>
                    <Hint text="Open in a new tab" side="bottom" align="start">
                    <Button 
                        size="sm"
                        disabled={!data.sandboxUrl}
                        variant="outline"
                        onClick={()=>{
                            if(!data.sandboxUrl) return;
                            window.open(data.sandboxUrl, "_blank");
                        }}
                        >
                        <ExternalLinkIcon/>
                    </Button>
                    </Hint>
                </div>
                <iframe
                    key={fragmentKey}
                    className="h-full w-full"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-modals allow-downloads"
                    allow="fullscreen; autoplay; gamepad; clipboard-write"
                    allowFullScreen
                    loading="lazy"
                    src={data.sandboxUrl}
                />
            </div>
        );
};