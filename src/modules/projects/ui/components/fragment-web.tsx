import { Fragment } from "@/generated/prisma";
import { useState } from "react";
import { ExternalLinkIcon , RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { set } from "date-fns";
import { Hint } from "@/components/ui/hint";
import { HTMLPreview } from "@/components/html-preview";

interface Props {
    data: Fragment;
};

export function FragmentWeb({ data }: Props){
        const [copied, setCopied] = useState(false);
        const [fragmentKey, setFragmentKey] = useState(0);

        const onRefresh = () => {
            setFragmentKey((prev) => prev + 1);
        };

        const handleCopy = () => {
            navigator.clipboard.writeText(data.sandboxUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        // Function to open static project in new tab
        const openStaticInNewTab = () => {
            if (!data.files || typeof data.files !== 'object') return;
            
            const files = data.files as {[path: string]: string};
            const indexHtml = files['index.html'];
            
            if (!indexHtml) return;

            // Combine all files into a single HTML document
            let combinedHTML = indexHtml;

            // Get all CSS files
            const cssFiles = Object.keys(files).filter(filename => 
                filename.endsWith('.css') && files[filename]
            );

            // Get all JS files  
            const jsFiles = Object.keys(files).filter(filename => 
                filename.endsWith('.js') && files[filename]
            );

            // Inject all CSS files
            cssFiles.forEach(cssFile => {
                const cssContent = files[cssFile];
                if (cssContent) {
                    const cssInjection = `<style>\n/* ${cssFile} */\n${cssContent}\n</style>`;
                    
                    if (combinedHTML.includes('</head>')) {
                        combinedHTML = combinedHTML.replace('</head>', `${cssInjection}\n</head>`);
                    } else if (combinedHTML.includes('<head>')) {
                        combinedHTML = combinedHTML.replace('<head>', `<head>\n${cssInjection}`);
                    } else {
                        combinedHTML = combinedHTML.replace('<html>', `<html>\n<head>\n${cssInjection}\n</head>`);
                    }
                }
            });

            // Inject all JS files
            jsFiles.forEach(jsFile => {
                const jsContent = files[jsFile];
                if (jsContent) {
                    const jsInjection = `<script>\n/* ${jsFile} */\n${jsContent}\n</script>`;
                    
                    if (combinedHTML.includes('</body>')) {
                        combinedHTML = combinedHTML.replace('</body>', `${jsInjection}\n</body>`);
                    } else {
                        combinedHTML += jsInjection;
                    }
                }
            });

            // Create a blob URL and open in new tab
            const blob = new Blob([combinedHTML], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            
            // Open in new tab
            const newWindow = window.open(blobUrl, '_blank');
            
            // Clean up blob URL after some time
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 1000);
        };

        // Check if this is a static project that can be previewed locally
        const isStaticProject = data.files && typeof data.files === 'object' && 
            ('index.html' in data.files);

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
                            {data.sandboxUrl}
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