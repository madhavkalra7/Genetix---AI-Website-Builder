import { CopyCheckIcon, CopyIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Fragment as FragmentModel } from "@/generated/prisma";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { CodeView } from "@/components/code-view";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import { convertFilestoTreeItems } from "@/lib/utils";
import { TreeView } from "./tree-view";

type FileCollection = { [path: string]: string };

function getLanguageFromExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension || "text";
}

interface FileBreadCrumbProps {
    filePath: string;

}

const FileBreadcrumb=({ filePath }:FileBreadCrumbProps)=>{
    const pathSegments=filePath.split("/");
    const maxSegments=4;

    const renderBreadcrumbItems= ()=>{
        if(pathSegments.length<=maxSegments){
            // Show all segments if 4 or less
            return pathSegments.map((segment,index)=>{
                const isLast=index===pathSegments.length-1;
                return (
                    <Fragment key={index}>
                        <BreadcrumbItem>
                            {isLast?(
                                <BreadcrumbPage className="font-medium">
                                    {segment}
                                </BreadcrumbPage>
                            ):(
                                <span className="text-muted-foreground">
                                    {segment}
                                </span>
                            )}
                        </BreadcrumbItem>
                        {!isLast && <BreadcrumbSeparator />}
                    </Fragment>
                )
            })
        }
        else{
            const firstSegment=pathSegments[0];
            const lastSegment=pathSegments[pathSegments.length-1];

            return (
                <>
                    <BreadcrumbItem>
                        <span className="text-muted-foreground">
                            {firstSegment}
                        </span>

                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbEllipsis/>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="font-medium">
                                {lastSegment}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbItem>
                </>
            )
        }
    };
    return (
        <Breadcrumb>
            <BreadcrumbList>
                {renderBreadcrumbItems()}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

interface FileExplorerProps {
    files: FileCollection;
    /** Fragment the files belong to; required for saving edits to the database */
    fragmentId?: string;
    /** Called with the persisted fragment after a successful save */
    onFileSaved?: (fragment: FragmentModel, filePath: string) => void;
    sandboxUrl?: string;
    projectId?: string;
};

// e.g. https://3000-igchdo1q4qbdq4o4ih50z.e2b.app -> igchdo1q4qbdq4o4ih50z
function getSandboxId(sandboxUrl?: string): string | null {
    if (!sandboxUrl) return null;
    try {
        const host = new URL(sandboxUrl).hostname;
        if (!host.endsWith(".e2b.app") && !host.endsWith(".e2b.dev")) return null;
        const id = host.split(".")[0].replace(/^\d+-/, "");
        return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
    } catch {
        return null;
    }
}

export const FileExplorer=({
    files,
    fragmentId,
    onFileSaved,
    sandboxUrl,
    projectId: projectIdProp,
}:FileExplorerProps) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const isMobile = useIsMobile();
    const [copied, setCopied] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    const [selectedFile,setSelectedFile]=useState<string>(()=>{
        const fileKeys=Object.keys(files);
        return fileKeys.length>0? fileKeys[0]:"";
    });

    // Editor buffer lives in local state; the `files` prop (query cache data) is never mutated
    const [editMode, setEditMode] = useState(false);
    const [editedCode, setEditedCode] = useState<string>("");

    const hasSelectedFile = !!selectedFile && files[selectedFile] !== undefined;
    const isDirty = editMode && hasSelectedFile && editedCode !== files[selectedFile];

    // Warn before leaving the page with unsaved edits
    useEffect(() => {
        if (!isDirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [isDirty]);

    const treeData=useMemo(()=>{
        return convertFilestoTreeItems(files);
    },[files])

    const handleFileSelect=useCallback((
        filePath:string
    )=>{
        if(files[filePath] === undefined || filePath === selectedFile) return;
        if (isDirty && !window.confirm("Discard unsaved changes?")) return;
        setEditMode(false);
        setSelectedFile(filePath);
    },[files, selectedFile, isDirty]);

    const handleCopy=useCallback(async ()=>{
        if(selectedFile){
            try {
                await navigator.clipboard.writeText(editMode ? editedCode : files[selectedFile]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (e) {
                toast.error("Couldn't copy to clipboard");
            }
        }
    }, [selectedFile, files, editMode, editedCode]);

    const handleDownloadZip = useCallback(async () => {
        try {
            setIsZipping(true);
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();


            Object.entries(files).forEach(([filePath, content]) => {
                const normalizedPath = filePath.replace(/^\.\/+/, "");
                zip.file(normalizedPath, content ?? "");
            });

            const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "project-code.zip";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (e) {
            console.error("ZIP download failed", e);
        } finally {
            setIsZipping(false);
        }
    }, [files]);

    const [explaining, setExplaining] = useState(false);
    const router = useRouter();

    // Prefer the projectId prop; fall back to guessing from file paths
    const projectId = projectIdProp || Object.keys(files)[0]?.split("/")[0] || "";

    const handleExplain = async () => {
        setExplaining(true);
        try {
            // Default model for OpenRouter (can be changed by user)
            const model = "meta-llama/llama-3.3-70b-instruct:free";
            const res = await fetch("/api/explain-project", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ files, model }),
            });
            const data = await res.json();
            if (data.explanation) {
                localStorage.setItem(`genetix_explanation_${projectId}`, data.explanation);
                router.push(`/project/${projectId}/explanation`);
            } else {
                toast.error(data.error || "Couldn't explain project");
            }
        } catch (e) {
            toast.error("Couldn't explain project");
        } finally {
            setExplaining(false);
        }
    };

    // Best effort: mirror the saved file into the live E2B sandbox so the running preview picks it up.
    // The database is the source of truth; a missing/expired sandbox does not fail the save.
    const syncSandboxFile = async (filePath: string, content: string) => {
        const sandboxId = getSandboxId(sandboxUrl);
        if (!sandboxId) return;
        try {
            const response = await fetch("/api/update-sandbox-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sandboxId, filePath, content }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) {
                console.warn("Live sandbox not updated:", result.error);
                toast.warning("Saved, but the live sandbox couldn't be updated (it may have expired).");
            }
        } catch (e) {
            console.warn("Live sandbox not updated:", e);
            toast.warning("Saved, but the live sandbox couldn't be updated (it may have expired).");
        }
    };

    const updateFile = useMutation(trpc.fragments.updateFile.mutationOptions({
        onSuccess: async (fragment, variables) => {
            toast.success("File saved");
            setEditMode(false);
            onFileSaved?.(fragment, variables.path);
            void syncSandboxFile(variables.path, variables.content);
            if (projectIdProp) {
                await queryClient.invalidateQueries(
                    trpc.messages.getMany.queryOptions({ projectId: projectIdProp }),
                );
            }
        },
        onError: (error) => {
            toast.error(error.message || "Failed to save file");
        },
    }));

    const isSaving = updateFile.isPending;

    const handleEdit = () => {
        setEditedCode(files[selectedFile] ?? "");
        setEditMode(true);
    };
    const handleCancelEdit = () => {
        if (isDirty && !window.confirm("Discard unsaved changes?")) return;
        setEditMode(false);
    };
    const handleSaveEdit = () => {
        if (!selectedFile || isSaving) return;
        if (!fragmentId) {
            toast.error("Can't save: this version has no saved fragment");
            return;
        }
        if (!isDirty) {
            setEditMode(false);
            return;
        }
        updateFile.mutate({ fragmentId, path: selectedFile, content: editedCode });
    };

    return (
        <ResizablePanelGroup
            key={isMobile ? "vertical" : "horizontal"}
            direction={isMobile ? "vertical" : "horizontal"}
        >
            <ResizablePanel defaultSize={isMobile ? 35 : 30} minSize={isMobile ? 15 : 30} className="bg-sidebar">
                <TreeView
                    data={treeData}
                    value={selectedFile}
                    onSelect={handleFileSelect}
                />
            </ResizablePanel>
            <ResizableHandle className="hover:bg-primary transition-colors"/>
            <ResizablePanel defaultSize={isMobile ? 65 : 70} minSize={isMobile ? 30 : 50}>
                {hasSelectedFile ?(
                    <div className="h-full w-full flex flex-col relative">
                        <div className="border-b bg-sidebar px-2 md:px-4 py-2 flex flex-wrap justify-between items-center gap-2">
                            <div className="min-w-0 flex items-center gap-2">
                                <FileBreadcrumb filePath={selectedFile}/>
                                {isDirty && (
                                    <span
                                        className="shrink-0 text-xs text-amber-600 dark:text-amber-400"
                                        title="Unsaved changes"
                                    >
                                        ● Unsaved
                                    </span>
                                )}
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <Hint text="Download ZIP" side="bottom">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDownloadZip}
                                        disabled={isZipping || Object.keys(files).length === 0}
                                        aria-label="Download ZIP"
                                    >
                                        <span className="hidden sm:inline">Download ZIP</span>
                                        <DownloadIcon className="sm:ml-2 h-4 w-4" />
                                    </Button>
                                </Hint>
                                <Hint text="Copy to clipboard" side="bottom">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopy}
                                        disabled={copied}
                                        aria-label="Copy to clipboard">
                                        {copied? <CopyCheckIcon/> : <CopyIcon/>}
                                    </Button>
                                </Hint>
                                {editMode ? (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveEdit}
                                            disabled={isSaving || !isDirty}
                                        >
                                            {isSaving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                                            Save
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleEdit}
                                    >
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto">
                            {editMode ? (
                                <textarea
                                    value={editedCode}
                                    onChange={e => setEditedCode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) {
                                            e.preventDefault();
                                            handleSaveEdit();
                                        }
                                    }}
                                    readOnly={isSaving}
                                    spellCheck={false}
                                    aria-label={`Edit ${selectedFile}`}
                                    className="block w-full h-full min-h-[300px] p-4 font-mono text-xs bg-zinc-900 text-white border-0 outline-none resize-none"
                                />
                            ) : (
                                <CodeView
                                    code={files[selectedFile]}
                                    lang={getLanguageFromExtension(selectedFile)}
                                />
                            )}
                        </div>
                        {/* Floating Explain Button - visible in code panel while not editing */}
                        {!editMode && (
                            <button
                                onClick={handleExplain}
                                disabled={explaining}
                                className="absolute bottom-4 right-4 md:bottom-8 md:right-8 z-50 animate-bounce bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 py-2 md:px-6 md:py-3 text-sm md:text-base shadow-lg border-2 border-orange-300 transition-all duration-300"
                                style={{
                                    boxShadow: "0 4px 24px 0 rgba(255,140,0,0.25)",
                                }}
                            >
                                {explaining ? "Explaining..." : "Explain"}
                            </button>
                        )}
                    </div>
                ):(
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        Select a file to view it&apos;s content
                    </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
