import { getQueryClient , trpc} from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense, createElement } from "react";
import { ProjectView } from "@/modules/projects/ui/views/project-view";
import { ErrorBoundary } from "react-error-boundary"

interface Props {
    params: Promise<{
        projectId: string;
    }>;
}

const Page = async ({ params }: Props) => {
    const { projectId } = await params;

    const queryClient= getQueryClient();
    
    // Don't await - let queries load in background
    // This allows immediate page render with loading state
    queryClient.prefetchQuery(trpc.messages.getMany.queryOptions({
        projectId,
    }));
    queryClient.prefetchQuery(trpc.projects.getOne.queryOptions({
        id: projectId,
    }));
    
    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ErrorBoundary fallback={createElement('p', null, 'Error!')}>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading project...</p>
                    </div>
                </div>}>
                    <ProjectView projectId={projectId} />
                </Suspense>
            </ErrorBoundary>
            {/* Project id : {projectId} */}
        </HydrationBoundary>
    );
};

export default Page;