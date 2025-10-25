"use client";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "next-auth/react";



const ProjectsList = () => {
  const trpc=useTRPC();
  const { user: customAuthUser } = useAuth();
  const { data: session } = useSession();
  
  // Use either custom auth user or NextAuth user
  const user = customAuthUser || session?.user;

  const { data:projects, isLoading, error }=useQuery(trpc.projects.getMany.queryOptions());

  console.log("ProjectsList render:", { 
    customAuthUser, 
    sessionUser: session?.user, 
    finalUser: user,
    projects, 
    isLoading, 
    error 
  });

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
        <h2 className="text-2xl font-semibold text-white">
          {(customAuthUser?.firstName || session?.user?.name || 'Your')}&apos;s Genetix
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {(!projects || projects?.length===0) && (
              <div className="col-span-full text-center">
                <p className="text-sm text-muted-foreground">
                  No projects found
                </p>
              </div>
            )}
            {projects?.map(project=>(
              <Button
                key={project.id}
                variant="outline"
                className="font-normal h-auto justify-start w-full text-start p-4 hover:bg-gray-400"
                asChild
              >
                <Link href={`/projects/${project.id}`}>
                  <div className="flex items-center gap-x-4">
                    <Image
                      src="/logo.png"
                      alt="genetix"
                      width={32}
                      height={32}
                      className="object-contain"
                      />
                      <div className="flex flex-col">
                        <h3 className="truncate font-medium">
                          {project.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(project.updatedAt, {
                              addSuffix: true,
                            })}
                          </span>
                        </p>
                      </div>
                  </div>
                </Link>
              </Button>
            ))}
        </div>
    </div>
  );
};

export default ProjectsList;