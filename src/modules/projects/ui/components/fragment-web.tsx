import { Fragment } from "@/generated/prisma";
import { useEffect, useRef, useState } from "react";
import { ExternalLinkIcon , RefreshCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { HTMLPreview } from "@/components/html-preview";
import { buildStandaloneHtml, hasStaticEntry } from "@/lib/static-html";

interface Props {
    data: Fragment;
};

export function FragmentWeb({ data }: Props){
        const [copied, setCopied] = useState(false);
        const [fragmentKey, setFragmentKey] = useState(0);
        const blobUrlRef = useRef<string | null>(null);

        // Free the last full-screen blob when leaving the page
        useEffect(() => () => {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        }, []);

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

        // Open the static project in a new tab (same rendering as the inline preview)
        const openStaticInNewTab = () => {
            if (!hasStaticEntry(data.files)) return;

            const html = buildStandaloneHtml(data.files);
            if (!html) {
                toast.error("No index.html found to open");
                return;
            }

            // Don't revoke right after opening: a slow tab would load a dead URL (blank page).
            // Keep it alive (so reloading the tab works) and only free the previous one.
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
            blobUrlRef.current = blobUrl;

            const newWindow = window.open(blobUrl, "_blank");
            if (!newWindow) {
                toast.error("Pop-up blocked. Allow pop-ups for this site to open the full-screen preview.");
                return;
            }
            // The generated site must not be able to control the Genetix tab
            try { newWindow.opener = null; } catch { /* ignore */ }
        };

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
                            <Button size="sm" variant="outline" onClick={onRefresh}>
                                <RefreshCcwIcon/>
                            </Button>
                        </Hint>
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
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={openStaticInNewTab}
                            >
                                <ExternalLinkIcon/>
                            </Button>
                        </Hint>
                    </div>
                    <div className="flex-1">
                        <HTMLPreview 
                            key={fragmentKey}
                            files={data.files as {[path: string]: string}} 
                            className="w-full h-full"
                        />
                    </div>
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
                    sandbox="allow-forms allow-scripts allow-same-origin"
                    loading="lazy"
                    src={data.sandboxUrl}
                />
            </div>
        );
};