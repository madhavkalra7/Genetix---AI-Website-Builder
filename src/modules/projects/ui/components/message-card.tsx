import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Fragment, MessageRole, MessageType } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ChevronRightIcon,ClockIcon,Code2Icon,HammerIcon,Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { PlanMarkdown } from "@/modules/plan/ui/plan-markdown";
import { VersionActions } from "./version-actions";

export const BUILD_FROM_PLAN_PROMPT = "Build it now based on our plan above.";

/** "Build this" CTA under the latest plan reply: starts a normal build (same mutation as the chat form). */
const BuildThisButton = ({ projectId }: { projectId: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createMessage = useMutation(trpc.messages.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
      queryClient.invalidateQueries(trpc.usage.status.queryOptions());
    },
    onError: (error) => {
      toast.error(error.message || "Couldn't start the build. Please try again.");
    },
  }));
  const isPending = createMessage.isPending || createMessage.isSuccess;
  return (
    <Button
      type="button"
      variant="venom"
      size="sm"
      className="w-fit px-4"
      disabled={isPending}
      onClick={() => createMessage.mutate({ projectId, value: BUILD_FROM_PLAN_PROMPT })}
    >
      {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <HammerIcon className="size-4" />}
      Build this
    </Button>
  );
};

interface UserMessageProps {
  content: string;
  /** Waiting behind the build that is currently running */
  queued?: boolean;
}

const UserMessage = ({ content, queued }: UserMessageProps) => {
  return (
    <div className="flex flex-col items-end gap-1 pb-4 pr-2 pl-6 md:pl-10">
      <Card className={cn(
        "rounded-lg bg-muted p-3 shadow-none border-none max-w-[85%] md:max-w-[80%] break-words [overflow-wrap:anywhere]",
        queued && "opacity-80",
      )}>
        {content}
      </Card>
      {queued && (
        <span
          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
          role="status"
        >
          <ClockIcon className="size-3" aria-hidden />
          Queued — starts after the current build
        </span>
      )}
    </div>
  );
};

/** Version context passed down from the messages container (enables the version menu) */
export interface VersionContext {
  projectId: string;
  latestFragmentId: string | null;
  isBuilding: boolean;
}

interface FragmentCardProps {
  fragment: Fragment;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
  version?: VersionContext;
};
const FragmentCard=({
  fragment,
  isActiveFragment,
  onFragmentClick,
  version,
}: FragmentCardProps) => {
  return (
    <div className="flex items-start gap-1 max-w-full min-w-0">
      <button type="button" className={cn(
        "flex items-start text-start gap-2 border rounded-lg bg-muted w-fit max-w-full min-w-0 p-3 hover:bg-secondary transition-colors",
        isActiveFragment && "bg-primary text-primary-foreground border-primary hover:bg-primary",
      )} onClick={()=> onFragmentClick(fragment)}>
        
        <Code2Icon className="size-4 mt-0.5"/>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-medium line-clamp-1 break-all">
            {fragment.title}
          </span>
          <span className="text-sm">Preview</span>
        </div>
        <div className="flex items-center justify-center mt-0.5">
          <ChevronRightIcon className="size-4"/>
        </div>
      </button>
      {version && (
        <VersionActions
          projectId={version.projectId}
          fragmentId={fragment.id}
          latestFragmentId={version.latestFragmentId}
          isBuilding={version.isBuilding}
          className="mt-2"
        />
      )}
    </div>
  )
}

interface AssistantMessageProps {
    content: string;
    fragment: Fragment | null;
    createdAt: Date;
    isActiveFragment: boolean;
    onFragmentClick: (fragment: Fragment) => void;
    type: MessageType;
    version?: VersionContext;
    /** Project id + flag: show the "Build this" CTA (only on the latest plan reply) */
    projectId?: string;
    showBuildThis?: boolean;
}

const AssistantMessage = ({content,
    fragment,
    createdAt,
    isActiveFragment,
    onFragmentClick,
    type,
    version,
    projectId,
    showBuildThis}: AssistantMessageProps) => {
    // Plan replies: ASSISTANT + RESULT with no fragment (builds always produce a fragment or an ERROR)
    const isPlanReply = type === "RESULT" && !fragment;
    return (
        <div className={cn("flex flex-col group px-2 pb-4",
            type==="ERROR" && "text-red-700 dark:text-red-500"
        )}>
            <div className="flex items-center gap-2 pl-2 mb-2">
              <Image
                src="/logo.png"
                alt="Genetix"
                width={18}
                height={18}
                className="shrink-0"
              />
                <span className="text-sm font-medium">Genetix</span>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {format(createdAt, "HH:mm 'on' MMM dd, yyyy")}
                </span>

            </div>
            <div className="pl-8.5 flex flex-col gap-y-4 min-w-0">
                {isPlanReply ? (
                  <PlanMarkdown content={content} />
                ) : (
                  <span className="break-words [overflow-wrap:anywhere]">{content}</span>
                )}
                {isPlanReply && showBuildThis && projectId && <BuildThisButton projectId={projectId} />}
                {fragment && type=="RESULT" && (
                  <FragmentCard
                    fragment={fragment}
                    isActiveFragment={isActiveFragment}
                    onFragmentClick={onFragmentClick}
                    version={version}
                  />
                )}
            </div>
        </div>
    );
}

interface MessageCardProps {
  content: string;
  role: MessageRole;
  fragment: Fragment | null;
  createdAt: Date;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
  type: MessageType;
  version?: VersionContext;
  projectId?: string;
  /** True only for the most recent plan reply when it is also the latest message */
  showBuildThis?: boolean;
  /** USER request waiting in the build queue (another build is running first) */
  queued?: boolean;
}

export const MessageCard = ({
  content,
  role,
  fragment,
  createdAt,
  isActiveFragment,
  onFragmentClick,
  type,
  version,
  projectId,
  showBuildThis,
  queued,
}: MessageCardProps) => {
  if (role === "ASSISTANT") {
    return (
        <AssistantMessage content={content} fragment={fragment} createdAt={createdAt} isActiveFragment={isActiveFragment} onFragmentClick={onFragmentClick} type={type} version={version} projectId={projectId} showBuildThis={showBuildThis} />
    );
  }
  return <UserMessage content={content} queued={queued} />;
};
