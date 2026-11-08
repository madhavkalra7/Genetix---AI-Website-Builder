import { useEffect, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { Fragment } from "@/generated/prisma";
import { MessageLoading } from "./message-loading";
interface Props {
    projectId: string;
    activeFragment:Fragment | null;
    setActiveFragment: (fragment:Fragment | null)=>void;
    /** Called when the user explicitly picks a version from the chat */
    onFragmentSelect?: (fragment: Fragment) => void;
}
export const MessagesContainer = ({ 
    projectId,
    activeFragment,
    setActiveFragment,
    onFragmentSelect,
}: Props) => {
    const bottomRef=useRef<HTMLDivElement>(null);
    const trpc = useTRPC();
    const lastAssistantMessageIdRef=useRef<string | null>(null);
    const { data: messages } = useSuspenseQuery(trpc.messages.getMany.queryOptions({
        projectId: projectId,
    },
    {
        refetchInterval:2000,
    }
));

    useEffect(() => {
        const lastAssistantMessage=messages.findLast(
            (message) => message.role==="ASSISTANT"
        );
        if(lastAssistantMessage?.fragments && lastAssistantMessage.id!==lastAssistantMessageIdRef.current){
            setActiveFragment(lastAssistantMessage.fragments);
            lastAssistantMessageIdRef.current=lastAssistantMessage.id;
        }
    },[messages,setActiveFragment]);

    // Keep the active fragment in sync with persisted data (e.g. after a code edit is saved).
    // Only move forward in time so a stale refetch can't overwrite a fresher save result.
    useEffect(() => {
        if (!activeFragment) return;
        const fresh = messages.find((message) => message.fragments?.id === activeFragment.id)?.fragments;
        if (fresh && new Date(fresh.updatedAt).getTime() > new Date(activeFragment.updatedAt).getTime()) {
            setActiveFragment(fresh);
        }
    },[messages, activeFragment, setActiveFragment]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    },[messages.length]);

    const lastMessage=messages[messages.length-1];
    const isLastMessageUser=lastMessage?.role==="USER";
    const latestFragmentId=messages.findLast(
        (message) => message.role==="ASSISTANT" && message.type==="RESULT" && !!message.fragments
    )?.fragments?.id ?? null;
    const version={ projectId, latestFragmentId, isBuilding: isLastMessageUser };

    return(
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="pt-2 pr-1 min-w-0">
                    {messages.map((message) => (
                        <MessageCard
                            key={message.id}
                            content={message.content}
                            role={message.role}
                            fragment={message.fragments}
                            createdAt={message.createdAt}
                            isActiveFragment={activeFragment?.id===message.fragments?.id}
                            onFragmentClick={(fragment) => {
                                setActiveFragment(fragment);
                                onFragmentSelect?.(fragment);
                            }}
                            type={message.type}
                            version={version}
                        />
                    ))}
                    {isLastMessageUser && <MessageLoading projectId={projectId} since={lastMessage.createdAt}/>}
                    <div ref={bottomRef}/>
                </div>
            </div>
            {/* {JSON.stringify(messages)} */}
            <div className="relative p-3 pt-1">
                <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none"/>
                <MessageForm projectId={projectId}/>
            </div>
        </div>
    )
}