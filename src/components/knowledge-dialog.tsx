"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { KNOWLEDGE_MAX_LENGTH } from "@/modules/knowledge/shared";

interface KnowledgeDialogProps {
    projectId: string;
    className?: string;
}

const PROJECT_PLACEHOLDER = `Brand: Crumbs Bakery, warm & playful tone, speaks to young families.
Always use INR prices (e.g. ₹249).
Primary colour #E85D3F, accent #FFD8A8; headings in "Playfair Display", body in "Inter".
Opening hours: Mon–Sat 8am–8pm. Phone: +91 98765 43210.
Never use stock photos of people.`;

const WORKSPACE_PLACEHOLDER = `Write in clear, friendly British English.
Always make layouts mobile-first and accessible (good contrast, alt text on images).
Prefer rounded corners and generous whitespace.
Never use stock photos of people.
Keep code simple: no unnecessary libraries.`;

interface KnowledgeEditorProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    loading: boolean;
    error?: string | null;
    saving: boolean;
    dirty: boolean;
    onSave: () => void;
    hint: string;
}

function KnowledgeEditor({
    id,
    value,
    onChange,
    placeholder,
    loading,
    error,
    saving,
    dirty,
    onSave,
    hint,
}: KnowledgeEditorProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
        );
    }
    if (error) {
        return <p className="py-4 text-sm text-destructive">{error}</p>;
    }
    const tooLong = value.length > KNOWLEDGE_MAX_LENGTH;
    return (
        <div className="grid gap-2 min-w-0">
            <p className="text-xs text-muted-foreground">{hint}</p>
            <Textarea
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty && !tooLong) onSave();
                }}
                placeholder={placeholder}
                className="min-h-56 max-h-[50vh] resize-y text-sm"
                disabled={saving}
                aria-invalid={tooLong}
                spellCheck
            />
            <div className="flex items-center justify-between gap-2">
                <span
                    className={cn(
                        "text-xs tabular-nums",
                        tooLong ? "text-destructive" : "text-muted-foreground"
                    )}
                >
                    {value.length.toLocaleString()} / {KNOWLEDGE_MAX_LENGTH.toLocaleString()}
                </span>
                <Button type="button" size="sm" onClick={onSave} disabled={saving || !dirty || tooLong}>
                    {saving && <Loader2Icon className="animate-spin" />}
                    Save
                </Button>
            </div>
        </div>
    );
}

export function KnowledgeDialog({ projectId, className }: KnowledgeDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"project" | "workspace">("project");
    const [projectText, setProjectText] = useState("");
    const [workspaceText, setWorkspaceText] = useState("");

    const projectQuery = useQuery({
        ...trpc.knowledge.getProject.queryOptions({ projectId }),
        enabled: open,
    });
    const workspaceQuery = useQuery({
        ...trpc.knowledge.getWorkspace.queryOptions(),
        enabled: open,
    });

    const savedProject = projectQuery.data?.knowledge ?? "";
    const savedWorkspace = workspaceQuery.data?.knowledge ?? "";

    // Load the saved text whenever the dialog opens (or the server value changes)
    useEffect(() => {
        if (open && projectQuery.isSuccess) setProjectText(savedProject);
    }, [open, projectQuery.isSuccess, savedProject]);
    useEffect(() => {
        if (open && workspaceQuery.isSuccess) setWorkspaceText(savedWorkspace);
    }, [open, workspaceQuery.isSuccess, savedWorkspace]);

    const saveProject = useMutation(
        trpc.knowledge.setProject.mutationOptions({
            onSuccess: async () => {
                await queryClient.invalidateQueries(trpc.knowledge.getProject.queryFilter({ projectId }));
                toast.success("Project knowledge saved", {
                    description: "Genetix will follow it on the next build or edit.",
                });
            },
            onError: (error) => toast.error(error.message || "Could not save project knowledge"),
        })
    );
    const saveWorkspace = useMutation(
        trpc.knowledge.setWorkspace.mutationOptions({
            onSuccess: async () => {
                await queryClient.invalidateQueries(trpc.knowledge.getWorkspace.queryFilter());
                toast.success("Workspace knowledge saved", {
                    description: "It now applies to all of your projects.",
                });
            },
            onError: (error) => toast.error(error.message || "Could not save workspace knowledge"),
        })
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("shrink-0", className)}
                    aria-label="Knowledge"
                    title="Knowledge"
                >
                    <BookOpenIcon />
                    <span className="hidden sm:inline">Knowledge</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Knowledge</DialogTitle>
                    <DialogDescription>
                        Genetix follows these instructions on every build and edit. Add your brand voice,
                        colours and fonts, audience, content facts and coding rules.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => setTab(v as "project" | "workspace")} className="min-w-0">
                    <TabsList className="w-full">
                        <TabsTrigger value="project">This project</TabsTrigger>
                        <TabsTrigger value="workspace">All my projects (workspace)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="project" className="mt-2">
                        <KnowledgeEditor
                            id="knowledge-project"
                            value={projectText}
                            onChange={setProjectText}
                            placeholder={PROJECT_PLACEHOLDER}
                            loading={projectQuery.isLoading}
                            error={projectQuery.isError ? projectQuery.error.message || "Could not load knowledge." : null}
                            saving={saveProject.isPending}
                            dirty={projectText.trim() !== savedProject}
                            onSave={() => saveProject.mutate({ projectId, knowledge: projectText })}
                            hint="Only applies to this project, on top of your workspace knowledge."
                        />
                    </TabsContent>
                    <TabsContent value="workspace" className="mt-2">
                        <KnowledgeEditor
                            id="knowledge-workspace"
                            value={workspaceText}
                            onChange={setWorkspaceText}
                            placeholder={WORKSPACE_PLACEHOLDER}
                            loading={workspaceQuery.isLoading}
                            error={workspaceQuery.isError ? workspaceQuery.error.message || "Could not load knowledge." : null}
                            saving={saveWorkspace.isPending}
                            dirty={workspaceText.trim() !== savedWorkspace}
                            onSave={() => saveWorkspace.mutate({ knowledge: workspaceText })}
                            hint="Applies to every project you build with Genetix."
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
