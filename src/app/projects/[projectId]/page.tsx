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
    void queryClient.prefetchQuery(trpc.messages.getMany.queryOptions({
        projectId,
    }));
    void queryClient.prefetchQuery(trpc.projects.getOne.queryOptions({
        id: projectId,
    }));
    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ErrorBoundary fallback={createElement('p', null, 'Error!')}>
                <Suspense fallback={createElement('p', null, 'Loading...')}>
                    <ProjectView projectId={projectId} />
                </Suspense>
            </ErrorBoundary>
            {/* Project id : {projectId} */}
        </HydrationBoundary>
    );
};

export default Page;