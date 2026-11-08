import { z } from "zod";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import {ArrowUpIcon,Loader2Icon,HammerIcon,MessagesSquareIcon } from "lucide-react";
import { useMutation ,useQuery,useQueryClient } from "@tanstack/react-query"; 
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form , FormField } from "@/components/ui/form";
import { Usage } from "./usage";
import { useRouter } from "next/navigation";
import { IMAGE_ATTACH_HINT, ImageAttachButton, ImageAttachThumbnails, ImageDropOverlay, useImageAttachments } from "@/components/image-attach";
import { SpeechInputButton } from "@/components/speech-input-button";



interface Props {
    projectId: string;
};

type ChatMode = "build" | "plan";
const PLAN_MAX_LENGTH = 4000;
const modeStorageKey = (projectId: string) => `genetix:chat-mode:${projectId}`;

const formSchema=z.object({
    value:z.string()
                    .min(1, { message: "Message is required"})
                    .max(10000,{ message: "Message is too long"}),
})

export const MessageForm=({ projectId }: Props) => {
    

    const trpc=useTRPC();
    const queryClient=useQueryClient();
    const router=useRouter();

    const{ data:usage }=useQuery(trpc.usage.status.queryOptions());
    // Text typed before dictation started (speech is appended after it)
    const speechBaseRef = useRef("");
    const form=useForm<z.infer<typeof formSchema>>({
        resolver:zodResolver(formSchema),
        defaultValues:{
            value:"",
        },
    });

    const createMessage=useMutation(trpc.messages.create.mutationOptions({
        onSuccess:()=>{
            form.reset();
            queryClient.invalidateQueries(
                trpc.messages.getMany.queryOptions({ projectId }),
            );
            queryClient.invalidateQueries(
                trpc.usage.status.queryOptions()
            );
        },
        onError:(error)=>{
            toast.error(error.message);
            if(error.data?.code==="TOO_MANY_REQUESTS" && !usage?.aiquestMode){
                router.push("/pricing");
            }
        }
    }

    ))

    // Build | Plan toggle, remembered per project
    const [mode,setMode]=useState<ChatMode>("build");
    useEffect(()=>{
        try {
            const saved=window.localStorage.getItem(modeStorageKey(projectId));
            setMode(saved==="plan" ? "plan" : "build");
        } catch {}
    },[projectId]);
    const changeMode=(next:ChatMode)=>{
        setMode(next);
        try { window.localStorage.setItem(modeStorageKey(projectId), next); } catch {}
    };
    const canPlan=!usage?.aiquestMode;
    const isPlanMode=canPlan && mode==="plan";

    const planChat=useMutation(trpc.plan.chat.mutationOptions({
        onSuccess:async ()=>{
            form.reset();
            // Awaited so the "thinking" indicator stays until the new messages are on screen
            await queryClient.invalidateQueries(
                trpc.messages.getMany.queryOptions({ projectId }),
            );
        },
        onError:(error)=>{
            toast.error(error.message || "Genetix couldn't reply. Please try again.");
        },
    }));

    // Reference images (screenshot / sketch / design) for Build messages
    const attachments=useImageAttachments({ disabled: createMessage.isPending || planChat.isPending || isPlanMode });

    const onSubmit=(values:z.infer<typeof formSchema>) =>{
        // Errors are surfaced via onError toast; mutate avoids an unhandled rejection
        if(attachments.isProcessing){
            toast.info("Still preparing your images — one moment.");
            return;
        }
        if(isPlanMode){
            if(attachments.images.length>0){
                toast.error("Attached images are used when building — switch to Build or remove them.");
                return;
            }
            if(values.value.length>PLAN_MAX_LENGTH){
                toast.error(`Plan messages can be up to ${PLAN_MAX_LENGTH} characters.`);
                return;
            }
            planChat.mutate({ projectId, message: values.value });
            return;
        }
        const images=attachments.dataUrls;
        createMessage.mutate({
            value: values.value,
            projectId,
            images: images.length>0 ? images : undefined,
        },{
            onSuccess:()=>attachments.clear(),
        });
    };

    const [isFocused,setIsFocused]=useState(false);
    const showUsage=!!usage;
    const isPending=createMessage.isPending || planChat.isPending;
    const isButtonDisabled=isPending || !form.formState.isValid;

    return (
        <Form {...form}>
            {planChat.isPending && (
                <div className="flex flex-col gap-2 pb-3 px-2" aria-live="polite">
                    <div className="self-end rounded-lg bg-muted p-3 max-w-[85%] text-sm break-words [overflow-wrap:anywhere] opacity-80">
                        {planChat.variables?.message}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin"/>
                        Genetix is thinking…
                    </div>
                </div>
            )}
            {showUsage && (
                <Usage 
                    remainingCredits={usage.remainingCredits} 
                    totalCredits={usage.creditsLimit}
                    aiquestMode={usage.aiquestMode}
                />
            )}
            <form onSubmit={form.handleSubmit(onSubmit)}
                className={cn(
                    "relative border p-3 md:p-4 pt-1 md:pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
                    isFocused && "shadow-xs",
                    showUsage && "rounded-t-none"
                )}
                {...attachments.dropHandlers}
                >
                    <ImageDropOverlay active={attachments.isDragging} className="text-foreground" />
                    <ImageAttachThumbnails
                        images={attachments.images}
                        onRemove={attachments.remove}
                        isProcessing={attachments.isProcessing}
                        disabled={isPending}
                        className="pt-3 [&_li]:border-border"
                    />
                    <FormField
                        control={form.control}
                        name="value"
                        render={({ field })=>(
                            <TextareaAutosize
                                {...field}
                                disabled={isPending}
                                minRows={2}
                                maxRows={8}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                onPaste={isPlanMode ? undefined : attachments.onPaste}
                                className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                                placeholder={isPlanMode ? "Chat with Genetix to plan your project…" : `What would you like to build?\n${IMAGE_ATTACH_HINT}`}
                                onKeyDown={(e)=>{
                                    if(e.key==="Enter" && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        form.handleSubmit(onSubmit)(e);
                                }
                                }}
                            />
                            
    )}
                    />
                    <div className="flex gap-x-2 items-end justify-between pt-2">
                        <div className="hidden md:block text-[10px] text-muted-foreground font-mono">
                            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                <span>
                                    &#8984;
                                </span>Enter
                            </kbd>
                            &nbsp;to submit
                        </div>
                        {/* 🎤 Speech to text: dictation is appended after whatever was already typed */}
                        <SpeechInputButton
                            disabled={isPending}
                            onStart={() => { speechBaseRef.current = form.getValues("value").trim(); }}
                            onTranscript={(text) => {
                                const base = speechBaseRef.current;
                                form.setValue("value", base ? `${base} ${text}` : text, { shouldValidate: true, shouldDirty: true });
                            }}
                        />
                        {!isPlanMode && (
                            <ImageAttachButton
                                onFiles={(files)=>void attachments.addFiles(files)}
                                disabled={isPending || !attachments.canAddMore}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                iconClassName="size-4"
                            />
                        )}
                        {canPlan && (
                            <div
                                role="radiogroup"
                                aria-label="Chat mode"
                                className="ml-auto flex items-center rounded-full border bg-background p-0.5 text-xs"
                            >
                                {([
                                    { value: "build", label: "Build", Icon: HammerIcon, title: "Build: generate or update the project (uses a credit)" },
                                    { value: "plan", label: "Plan", Icon: MessagesSquareIcon, title: "Plan: chat with Genetix about what to build (free)" },
                                ] as const).map(({ value, label, Icon, title }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={mode===value}
                                        title={title}
                                        disabled={isPending}
                                        onClick={() => changeMode(value)}
                                        className={cn(
                                            "flex items-center gap-1 rounded-full px-2.5 h-7 transition-colors disabled:opacity-60",
                                            mode===value
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="size-3.5"/>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <Button
                            disabled={isButtonDisabled}
                            aria-label={isPlanMode ? "Send to Genetix" : "Build"}
                            className={cn(
                                "size-8 rounded-full shrink-0",
                                !canPlan && "ml-auto",
                                isButtonDisabled && "bg-muted-foreground border"
                            )}
                        >
                            {isPending ? (
                                <Loader2Icon className="size-4 animate-spin"/>

                            ):(<ArrowUpIcon/>)}
                        </Button>
                    </div>
            </form>
            
        </Form>
    )
}
