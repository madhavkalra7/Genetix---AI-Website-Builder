"use client";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "next-auth/react";
import { StaggerContainer, StaggerItem } from "@/components/animations/fade-in";
import { SpotlightCard } from "@/components/animations/spotlight-card";
import { EditableProjectName } from "@/components/editable-project-name";



const ProjectsList = () => {
  const trpc=useTRPC();
  const { user: customAuthUser } = useAuth();
  const { data: session } = useSession();
  
  // Use either custom auth user or NextAuth user
  const user = customAuthUser || session?.user;

  const { data:projects, isLoading, error }=useQuery(
    trpc.projects.getMany.queryOptions(undefined, { enabled: !!user })
  );

  const queryClient = useQueryClient();
  const renameProject = useMutation(
    trpc.projects.rename.mutationOptions({
      onSuccess: async (_data, variables) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.projects.getMany.queryFilter()),
          queryClient.invalidateQueries(trpc.projects.getOne.queryFilter({ id: variables.id })),
        ]);
      },
    })
  );

  if(!user){
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-y-6 sm:gap-y-4">
        <h2 className="text-2xl font-semibold text-white">
          {(customAuthUser?.firstName || session?.user?.name || 'Your')}&apos;s Genetix
        </h2>
        <p className="text-white/60">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-y-6 sm:gap-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">
          {(customAuthUser?.firstName || session?.user?.name || 'Your')}&apos;s Genetix
        </h2>
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {error && (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-red-400">
                  Failed to load projects. Please try again.
                </p>
              </div>
            )}
            {!error && (!projects || projects?.length===0) && (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No projects found
                </p>
              </div>
            )}
            {projects?.map(project=>(
              <StaggerItem key={project.id} className="transition-transform duration-300 hover:-translate-y-1">
                <SpotlightCard className="h-full">
                  <Link href={`/projects/${project.id}`} className="group block p-3 sm:p-4">
                    <div className="flex items-center gap-x-3 sm:gap-x-4 w-full">
                      <Image
                        src="/logo.png"
                        alt="genetix"
                        width={28}
                        height={28}
                        className="object-contain flex-shrink-0 sm:w-8 sm:h-8"
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <EditableProjectName
                            as="h3"
                            name={project.name}
                            onSave={async (name) => {
                              await renameProject.mutateAsync({ id: project.id, name });
                            }}
                            revealOnHover
                            nameClassName="font-medium text-sm sm:text-base text-white"
                            buttonClassName="text-white/50 hover:text-white"
                            iconClassName="text-current"
                          />
                          <p className="text-xs sm:text-sm text-white/50 truncate">
                            {formatDistanceToNow(project.updatedAt, {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                    </div>
                  </Link>
                </SpotlightCard>
              </StaggerItem>
            ))}
        </StaggerContainer>
    </div>
  );
};

export default ProjectsList;