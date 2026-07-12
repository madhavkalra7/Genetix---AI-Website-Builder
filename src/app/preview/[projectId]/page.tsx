"use client";

import { useParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { HTMLPreview } from "@/components/html-preview";
import { Loader2Icon, SmartphoneIcon } from "lucide-react";

export default function PublicAppPreviewPage() {
  const params = useParams();
  const trpc = useTRPC();
  const projectId = params?.projectId as string;

  // Fetch the public static app files (html/css/js) by project UUID
  const { data: files, isLoading, isError } = useQuery(
    trpc.appProjects.getPublicPreview.queryOptions(
      { projectId: projectId || "" },
      { enabled: !!projectId, retry: false }
    )
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white gap-4 font-sans select-none">
        <Loader2Icon className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-xs text-white/50 uppercase tracking-widest font-[Orbitron]">Loading App Preview...</p>
      </div>
    );
  }

  if (isError || !files) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white p-6 text-center gap-4 font-sans">
        <SmartphoneIcon className="w-12 h-12 text-red-500/80 animate-bounce" />
        <h1 className="text-lg font-bold font-[Orbitron] text-red-400">Preview Not Found</h1>
        <p className="text-xs text-white/60 max-w-xs font-[Orbitron]">
          We couldn't retrieve the mobile app files for this project. Please make sure the app was fully compiled on the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-neutral-900 overflow-hidden">
      <HTMLPreview
        files={files}
        className="w-full h-full border-0"
      />
    </div>
  );
}
