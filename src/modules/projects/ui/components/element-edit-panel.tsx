"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon, MousePointerClickIcon, SendIcon, XIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SelectedElementInfo } from "@/components/html-preview";

const MAX_REQUEST_LENGTH = 2000;

export const buildElementEditPrompt = (element: SelectedElementInfo, request: string) =>
    `Edit ONLY this element and keep everything else unchanged.\nElement: ${element.selector}\nCurrent HTML (truncated):\n${element.html}\n\nRequested change: ${request.trim()}`;

const elementLabel = (element: SelectedElementInfo) => {
    const text = element.text.trim();
    const snippet = text.length > 40 ? text.slice(0, 39) + "…" : text;
    return snippet ? `<${element.tag}> “${snippet}”` : `<${element.tag}>`;
};

interface Props {
    projectId: string;
    /** null = select mode on, nothing picked yet */
    element: SelectedElementInfo | null;
    onCancel: () => void;
    onSent: () => void;
}

/** Docked at the bottom of the preview while click-to-edit is active. */
export function ElementEditPanel({ projectId, element, onCancel, onSent }: Props) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();
    const [request, setRequest] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { data: usage } = useQuery(trpc.usage.status.queryOptions());

    // Same mutation + credit handling as the chat form (message-form.tsx)
    const createMessage = useMutation(
        trpc.messages.create.mutationOptions({
            onSuccess: () => {
                setRequest("");
                queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
                queryClient.invalidateQueries(trpc.usage.status.queryOptions());
                toast.success("Edit requested — rebuilding");
                onSent();
            },
            onError: (error) => {
                toast.error(error.message);
                if (error.data?.code === "TOO_MANY_REQUESTS" && !usage?.aiquestMode) {
                    router.push("/pricing");
                }
            },
        }),
    );

    // Focus the request box as soon as an element is picked
    useEffect(() => {
        if (element) textareaRef.current?.focus();
    }, [element]);

    const canSend = !!element && request.trim().length > 0 && !createMessage.isPending;

    const send = () => {
        if (!element || !canSend) return;
        createMessage.mutate({ projectId, value: buildElementEditPrompt(element, request) });
    };

    return (
        <div
            className="absolute inset-x-2 bottom-2 z-10 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:w-96"
            role="dialog"
            aria-label="Edit selected element"
        >
            <div className="flex items-center gap-2">
                <MousePointerClickIcon className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                    {element ? (
                        <p className="truncate font-mono text-xs" title={element.selector}>
                            {elementLabel(element)}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Click an element in the preview to edit it · Esc to cancel
                        </p>
                    )}
                </div>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    onClick={onCancel}
                    aria-label="Cancel element editing"
                    disabled={createMessage.isPending}
                >
                    <XIcon />
                </Button>
            </div>

            {element && (
                <form
                    className="mt-2 flex flex-col gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        send();
                    }}
                >
                    <label htmlFor="element-edit-request" className="sr-only">
                        What should change?
                    </label>
                    <Textarea
                        id="element-edit-request"
                        ref={textareaRef}
                        value={request}
                        onChange={(e) => setRequest(e.target.value.slice(0, MAX_REQUEST_LENGTH))}
                        placeholder="What should change?"
                        rows={3}
                        maxLength={MAX_REQUEST_LENGTH}
                        disabled={createMessage.isPending}
                        className="min-h-16 max-h-40 resize-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                send();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                onCancel();
                            }
                        }}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className="hidden text-[10px] text-muted-foreground sm:inline">
                            ⌘/Ctrl+Enter to send
                        </span>
                        <Button type="submit" size="sm" className="ml-auto" disabled={!canSend}>
                            {createMessage.isPending ? (
                                <Loader2Icon className="animate-spin" />
                            ) : (
                                <SendIcon />
                            )}
                            Send
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
