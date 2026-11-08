"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MessagesContainer } from "../components/messages-container";
import { Suspense, useCallback, useState } from "react";
import { Fragment } from "@/generated/prisma";
import { ProjectHeader } from "../components/project-header";
import { FragmentWeb } from "../components/fragment-web";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EyeIcon, CodeIcon, CrownIcon, MessageSquareIcon, CopyIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileExplorer } from "@/components/file-explorer";
import { CodeWritingAnimation } from "@/components/code-writing-animation";
import { UserControl } from "@/components/user-control";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "react-error-boundary";
import { ProjectLoading } from "@/components/project-loading";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/hint";
import { useDuplicateProject } from "../components/version-actions";

interface Props {
  projectId: string;
}

type WorkspaceTab = "preview" | "code";
type MobileTab = "chat" | WorkspaceTab;

export const ProjectView = ({ projectId }: Props) => {
  const { user } = useAuth();
  const trpc = useTRPC();

  // Fetch user's current subscription
  const { data: subscription } = useQuery(
    trpc.subscription.getMySubscription.queryOptions()
  );

  const hasProAccess = subscription?.plan?.name === "pro" || subscription?.plan?.name === "enterprise";
  const isAiquest = !!user?.aiquestUserId;
  const showUpgrade = !hasProAccess && !isAiquest;
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [tabState, setTabState] = useState<WorkspaceTab>("preview");
  // Below `md` only one panel is shown at a time. Visibility is driven purely by
  // `max-md:` CSS classes, so server and client render the same markup (no hydration
  // mismatch, no layout flash) and the desktop layout is untouched.
  const [mobilePanel, setMobilePanel] = useState<"chat" | "workspace">("chat");
  const mobileTab: MobileTab = mobilePanel === "chat" ? "chat" : tabState;

  const handleMobileTabChange = (value: string) => {
    if (value === "chat") {
      setMobilePanel("chat");
    } else {
      setMobilePanel("workspace");
      setTabState(value as WorkspaceTab);
    }
  };

  // Picking a version from the chat on a phone jumps to its preview
  const handleFragmentSelect = useCallback(() => {
    setMobilePanel("workspace");
    setTabState("preview");
  }, []);

  // After a click-to-edit request on a phone, show the chat so the build progress is visible
  const handleEditSent = useCallback(() => {
    setMobilePanel("chat");
  }, []);

  // "Building" = same signal as the chat (last message is the USER's request) or a running build.
  // Shares the cache with MessagesContainer (which polls every 2s), so this adds no requests.
  const { data: messages } = useQuery(trpc.messages.getMany.queryOptions({ projectId }));
  const lastMessage = messages?.[messages.length - 1];
  const awaitingReply = lastMessage?.role === "USER";
  const { data: latestBuild } = useQuery(
    trpc.builds.getLatest.queryOptions(
      { projectId, isApp: false },
      {
        refetchInterval: (query) =>
          awaitingReply || query.state.data?.status === "running" ? 1500 : false,
        refetchIntervalInBackground: false,
        retry: 1,
      },
    ),
  );
  // A "running" row with no pending request is only trusted while it's fresh (guards against stuck rows)
  const buildRunning =
    latestBuild?.status === "running" &&
    Date.now() - new Date(latestBuild.startedAt).getTime() < 30 * 60 * 1000;
  const isBuilding = awaitingReply || buildRunning;

  const duplicateProject = useDuplicateProject(projectId);

  // Swap in the persisted fragment returned by the save mutation (never mutate cached objects)
  const handleFileSaved = useCallback((fragment: Fragment) => {
    setActiveFragment((current) => (current?.id === fragment.id ? fragment : current));
  }, []);

  const upgradeButton = showUpgrade && (
    <Button asChild size="sm" variant="tertiary">
      <Link href="/pricing" aria-label="Upgrade">
        <CrownIcon /> <span className="max-md:hidden">Upgrade</span>
      </Link>
    </Button>
  );

  return (
    <div className="h-dvh flex flex-col">
      {/* Mobile-only top bar: one panel at a time */}
      <div className="md:hidden flex items-center gap-x-2 p-2 border-b">
        <Tabs
          value={mobileTab}
          onValueChange={handleMobileTabChange}
          className="flex-1 min-w-0"
        >
          <TabsList className="h-8 p-0 border rounded-md w-full">
            <TabsTrigger value="chat" className="rounded-md" aria-label="Chat">
              <MessageSquareIcon /> <span className="max-[359px]:hidden">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="rounded-md" aria-label="Preview">
              <EyeIcon /> <span className="max-[359px]:hidden">Preview</span>
            </TabsTrigger>
            <TabsTrigger value="code" className="rounded-md" aria-label="Code">
              <CodeIcon /> <span className="max-[359px]:hidden">Code</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-x-2 shrink-0">
          {upgradeButton}
          <UserControl />
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            defaultSize={35}
            minSize={20}
            className={cn(
              "flex flex-col min-h-0",
              mobilePanel !== "chat" && "max-md:hidden"
            )}
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
                  onFragmentSelect={handleFragmentSelect}
                />
              </Suspense>
            </ErrorBoundary>
          </ResizablePanel>
          <ResizableHandle className="hover:bg-primary transition-colors max-md:hidden" />
          <ResizablePanel
            defaultSize={65}
            minSize={50}
            className={cn(
              "flex flex-col min-h-0",
              mobilePanel === "chat" && "max-md:hidden"
            )}
          >
            <Tabs
              className="h-full gap-y-0"
              defaultValue="preview"
              value={tabState}
              onValueChange={(value) => setTabState(value as WorkspaceTab)}
            >
              {/* Desktop header; on mobile the top bar above replaces it */}
              <div className="w-full hidden md:flex items-center p-2 border-b gap-x-2">
                <TabsList className="h-8 p-0 border rounded-md">
                  <TabsTrigger value="preview" className="rounded-md">
                    <EyeIcon /> <span>Demo</span>
                  </TabsTrigger>
                  <TabsTrigger value="code" className="rounded-md">
                    <CodeIcon /> <span>code</span>
                  </TabsTrigger>
                </TabsList>
                <div className="ml-auto flex items-center gap-x-2">
                  {!!activeFragment && (
                    <Hint text="Duplicate project (latest version)" side="bottom">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label="Duplicate project"
                        disabled={duplicateProject.isPending}
                        onClick={() => duplicateProject.mutate({ projectId })}
                      >
                        {duplicateProject.isPending ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
                        <span className="max-lg:hidden">Duplicate</span>
                      </Button>
                    </Hint>
                  )}
                  {upgradeButton}
                  <UserControl />
                </div>
              </div>
              <TabsContent value="preview">
                {!!activeFragment ? (
                  <FragmentWeb data={activeFragment} projectId={projectId} onEditSent={handleEditSent} />
                ) : (
                  <ProjectLoading className="w-full h-full" />
                )}
              </TabsContent>
              <TabsContent value="code" className="min-h-0 h-full flex-1">
                {isBuilding ? (
                  <div className="relative h-full min-h-[400px]">
                    <CodeWritingAnimation
                      projectId={projectId}
                      since={awaitingReply ? lastMessage?.createdAt : null}
                    />
                  </div>
                ) : !!activeFragment?.files ? (
                  <div className="relative h-full min-h-[400px]">
                    <FileExplorer
                      key={activeFragment.id}
                      projectId={projectId}
                      fragmentId={activeFragment.id}
                      files={activeFragment.files as { [path: string]: string }}
                      sandboxUrl={activeFragment.sandboxUrl}
                      onFileSaved={handleFileSaved}
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
    </div>
  );
};
