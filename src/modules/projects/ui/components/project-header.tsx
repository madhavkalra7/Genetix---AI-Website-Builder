import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import{
    ChevronDownIcon,
    ChevronLeftIcon,
    SunMoonIcon,
} from "lucide-react";

import { useTRPC }  from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { EditableProjectName } from "@/components/editable-project-name";
import { PublishDialog } from "@/components/publish-dialog";
import { PublishSecurityCheck } from "@/components/publish-security-check";
import { SupabaseDialog } from "@/components/supabase-dialog";
import { KnowledgeDialog } from "@/components/knowledge-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRadioGroup,DropdownMenuRadioItem,DropdownMenuSeparator,DropdownMenuSub,DropdownMenuSubContent,DropdownMenuSubTrigger,DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";

interface Props {
    projectId:string;
}
export const ProjectHeader=({ projectId }: Props)=>{
    const trpc=useTRPC();
    const { data: project }=useSuspenseQuery(
        trpc.projects.getOne.queryOptions({ id:projectId })
    );

    const { setTheme, theme }=useTheme();
    const queryClient=useQueryClient();
    const renameProject=useMutation(trpc.projects.rename.mutationOptions({
        onSuccess: async ()=>{
            await Promise.all([
                queryClient.invalidateQueries(trpc.projects.getOne.queryFilter({ id: projectId })),
                queryClient.invalidateQueries(trpc.projects.getMany.queryFilter()),
            ]);
        },
    }));

    return (
    <header className="p-2 flex justify-between items-center gap-2 border-b min-w-0">
        <div className="flex min-w-0 flex-1 items-center">
        <EditableProjectName
            name={project.name}
            onSave={async (name)=>{
                await renameProject.mutateAsync({ id: projectId, name });
            }}
            className="gap-0.5"
            editingClassName="gap-1.5 pl-2 py-0.5 w-full max-w-sm"
            editingPrefix={<Image src="/logo.png" alt="Genetix" width={18} height={18} className="shrink-0"/>}
            nameClassName="text-sm font-medium"
            inputClassName="h-7 bg-transparent border-border focus:border-primary/60 focus:ring-primary/30"
            renderDisplay={({ nameElement, pencil })=>(
                <>
                <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="focus-visible:ring-0 hover:bg-transparent hover:opacity-75 transition-opacity pl-2 min-w-0 max-w-full shrink"
                >
                    <Image src="/logo.png" alt="Genetix" width={18} height={18}/>
                    {nameElement}
                    <ChevronDownIcon/>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start">
                <DropdownMenuItem asChild>
                    <Link href="/">
                        <ChevronLeftIcon/>
                        <span>
                            Go to Dashboard
                        </span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                        <SunMoonIcon className="size-4 text-muted-foreground"/>
                        <span>Appearance</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                                <DropdownMenuRadioItem value="light">
                                    <span>Light</span>
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="dark">
                                    <span>Dark</span>
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="system">
                                    <span>System</span>
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
                {pencil}
                </>
            )}
        />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
            <KnowledgeDialog projectId={projectId}/>
            <SupabaseDialog projectId={projectId}/>
            <ShareDialog projectId={projectId} projectName={project.name}/>
            <PublishDialog
                projectId={projectId}
                projectName={project.name}
                techStack={project.techStack}
                securitySlot={<PublishSecurityCheck projectId={projectId} />}
            />
        </div>
    </header>
    )
};