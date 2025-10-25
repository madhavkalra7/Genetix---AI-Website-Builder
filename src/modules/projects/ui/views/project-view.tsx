"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MessagesContainer } from "../components/messages-container";
import { Suspense, useState } from "react";
import { Fragment } from "@/generated/prisma";
import { ProjectHeader } from "../components/project-header";
import { FragmentWeb } from "../components/fragment-web";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EyeIcon, CodeIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileExplorer } from "@/components/file-explorer";
import { UserControl } from "@/components/user-control";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "react-error-boundary";
import { ProjectLoading } from "@/components/project-loading";

interface Props {
  projectId: string;
}

export const ProjectView = ({ projectId }: Props) => {
  const { user } = useAuth();
  // TODO: Check user's subscription plan from database
  const hasProAccess = false; // Will be implemented with subscription checking
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFileUpdate = async (filePath: string, content: string) => {
    // Update the fragment files in local state
    if (activeFragment?.files) {
      (activeFragment.files as any)[filePath] = content;
    }
    
    // Trigger a refresh of the preview
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={35}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <ErrorBoundary fallback={<p>Error loading project header</p>}>
            <Suspense fallback={<p>Loading project...</p>}>
              <ProjectHeader projectId={projectId} />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary fallback={<p>Error loading messages</p>}>
            <Suspense fallback={<p>Loading messages...</p>}>
              <MessagesContainer
                projectId={projectId}
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
              />
            </Suspense>
          </ErrorBoundary>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-primary transition-colors" />
        <ResizablePanel
          defaultSize={65}
          minSize={50}
          className="flex flex-col min-h-0"
        >
          <Tabs
            className="h-full gap-y-0"
            defaultValue="preview"
            value={tabState}
            onValueChange={(value) => setTabState(value as "preview" | "code")}
          >
            <div className="w-full flex items-center p-2 border-b gap-x-2">
              <TabsList className="h-8 p-0 border rounded-md">
                <TabsTrigger value="preview" className="rounded-md">
                  <EyeIcon /> <span>Demo</span>
                </TabsTrigger>
                <TabsTrigger value="code" className="rounded-md">
                  <CodeIcon /> <span>code</span>
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-x-2">
                {!hasProAccess && (
                  <Button asChild size="sm" variant="tertiary">
                    <Link href="/pricing">
                      <CrownIcon /> Upgrade
                    </Link>
                  </Button>
                )}
                <UserControl />
              </div>
            </div>
            <TabsContent value="preview">
              {!!activeFragment ? (
                <FragmentWeb key={`${refreshKey}-preview`} data={activeFragment} />
              ) : (
                <ProjectLoading className="w-full h-full" />
              )}
            </TabsContent>
            <TabsContent value="code" className="min-h-0 h-full flex-1">
              {!!activeFragment?.files ? (
                <div className="relative h-full min-h-[400px]">
                  <FileExplorer
                    files={activeFragment.files as { [path: string]: string }}
                    sandboxUrl={activeFragment.sandboxUrl}
                    onFileUpdate={handleFileUpdate}
                  />
                </div>
              ) : (
                <ProjectLoading className="w-full h-full" />
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
