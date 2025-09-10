import { CopyCheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { set } from "date-fns";
import { TreeView } from "./tree-view";
import path from "path";

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
    files:FileCollection;
    onFileUpdate?: (filePath: string, content: string) => void;
    sandboxUrl?: string;
};

export const FileExplorer=({
    files,
    onFileUpdate,
    sandboxUrl,
}:FileExplorerProps) => {
    const [copied, setCopied] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    const [selectedFile,setSelectedFile]=useState<string>(()=>{
        const fileKeys=Object.keys(files);
        return fileKeys.length>0? fileKeys[0]:"";
    });

    const treeData=useMemo(()=>{
        return convertFilestoTreeItems(files);
    },[files])

    const handleFileSelect=useCallback((
        filePath:string
    )=>{
        if(files[filePath]){
            setSelectedFile(filePath);
        }
    },[files]);

    const handleCopy=useCallback(()=>{
        if(selectedFile){
            navigator.clipboard.writeText(files[selectedFile]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [selectedFile, files]);

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
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("ZIP download failed", e);
        } finally {
            setIsZipping(false);
        }
    }, [files]);

    const [explaining, setExplaining] = useState(false);
    const router = useRouter();

    // Get projectId from file paths (assuming all files start with projectId or pass as prop)
    // You may want to pass projectId as a prop for reliability
    const projectId = Object.keys(files)[0]?.split("/")[0] || "";

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
            }
        } catch (e) {
            // Optionally show error
        } finally {
            setExplaining(false);
        }
    };

        // Editable code state
        const [editMode, setEditMode] = useState(false);
        const [editedCode, setEditedCode] = useState<string>("");

        useEffect(() => {
            if (selectedFile) {
                setEditedCode(files[selectedFile] || "");
                setEditMode(false);
            }
        }, [selectedFile, files]);

        const handleEdit = () => setEditMode(true);
        const handleCancelEdit = () => {
            setEditedCode(files[selectedFile] || "");
            setEditMode(false);
        };
        const handleSaveEdit = async () => {
            if (selectedFile) {
                files[selectedFile] = editedCode;
                setEditMode(false);
                
                // Update the sandbox with new file content
                if (onFileUpdate) {
                    onFileUpdate(selectedFile, editedCode);
                }
                
                // Update sandbox files via API
                if (sandboxUrl) {
                    try {
                        // Extract sandbox ID from URL (e.g., https://3000-igchdo1q4qbdq4o4ih50z.e2b.app -> igchdo1q4qbdq4o4ih50z)
                        const urlParts = sandboxUrl.replace('https://', '').split('.');
                        const sandboxId = urlParts[0].replace('3000-', '');
                        
                        console.log("Updating sandbox file:", { sandboxId, filePath: selectedFile, content: editedCode.substring(0, 100) });
                        
                        const response = await fetch("/api/update-sandbox-file", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                sandboxId,
                                filePath: selectedFile,
                                content: editedCode
                            })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            console.log("File updated successfully in sandbox");
                            
                            // Force refresh the iframe
                            const iframe = document.querySelector('iframe') as HTMLIFrameElement;
                            if (iframe) {
                                iframe.src = iframe.src;
                            }
                        } else {
                            console.error("Failed to update sandbox file:", result.error);
                        }
                    } catch (e) {
                        console.error("Failed to update sandbox file:", e);
                    }
                }
            }
        };

        return (
                <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={30} minSize={30} className="bg-sidebar">
                                <TreeView
                                        data={treeData}
                                        value={selectedFile}
                                        onSelect={handleFileSelect}
                                />
                        </ResizablePanel>
                        <ResizableHandle className="hover:bg-primary transition-colors"/>
                        <ResizablePanel defaultSize={70} minSize={50}>
                                {selectedFile && files[selectedFile] ?(
                                        <div className="h-full w-full flex flex-col relative">
                                                <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center gap-x-2">
                                                        <FileBreadcrumb filePath={selectedFile}/>
                                                        <div className="ml-auto flex items-center gap-2">
                                                                <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={handleDownloadZip}
                                                                        disabled={isZipping || Object.keys(files).length === 0}
                                                                >
                                                                        <span>Download ZIP</span>
                                                                        <DownloadIcon className="ml-2 h-4 w-4" />
                                                                </Button>
                                                                <Hint text="Copy to clipboard" side="bottom">
                                                                        <Button 
                                                                                variant="outline" 
                                                                                size="icon" 
                                                                                onClick={handleCopy} 
                                                                                disabled={copied}>
                                                                                {copied? <CopyCheckIcon/> : <CopyIcon/>}
                                                                        </Button>
                                                                </Hint>
                                                                {!editMode && (
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
                                                <div className="flex-1 overflow-auto">
                                                        {editMode ? (
                                                            <div className="h-full w-full flex flex-col">
                                                                <textarea
                                                                    value={editedCode}
                                                                    onChange={e => setEditedCode(e.target.value)}
                                                                    className="w-full h-full p-4 font-mono text-xs bg-zinc-900 text-white border border-zinc-700 rounded-lg resize-vertical"
                                                                    style={{ minHeight: "300px" }}
                                                                />
                                                                <div className="flex gap-2 mt-2">
                                                                    <Button variant="outline" size="sm" onClick={handleSaveEdit}>Save</Button>
                                                                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <CodeView
                                                                code={files[selectedFile]}
                                                                lang={getLanguageFromExtension(selectedFile)}
                                                            />
                                                        )}
                                                </div>
                                                {/* Floating Explain Button - always visible in code panel */}
                                                <button
                                                        onClick={handleExplain}
                                                        disabled={explaining}
                                                        className="absolute bottom-8 right-8 z-50 animate-bounce bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6 py-3 shadow-lg border-2 border-orange-300 transition-all duration-300"
                                                        style={{
                                                                boxShadow: "0 4px 24px 0 rgba(255,140,0,0.25)",
                                                        }}
                                                >
                                                        {explaining ? "Explaining..." : "Explain"}
                                                </button>
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