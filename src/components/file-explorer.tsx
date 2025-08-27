import { CopyCheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useState, useMemo, useCallback, Fragment } from "react";

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
};

export const FileExplorer=({
    files,
}:FileExplorerProps) => {
    const [copied, setCopied] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    const [selectedFile,setSelectedFile]=useState<string|null>(()=>{
        const fileKeys=Object.keys(files);
        return fileKeys.length>0? fileKeys[0]:null;
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
                    <div className="h-full w-full flex flex-col">
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
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <CodeView
                                code={files[selectedFile]}
                                lang={getLanguageFromExtension(selectedFile)}
                            >

                            </CodeView>
                        </div>
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