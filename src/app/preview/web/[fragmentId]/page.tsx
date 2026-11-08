"use client";

// Full-screen preview of a static (HTML/CSS/JS) website version.
// Opened with a normal link from the project page, so pop-up blockers never interfere,
// and it survives reloads (unlike the old in-memory blob tab).

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MonitorXIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { HTMLPreview } from "@/components/html-preview";

export default function WebFragmentPreviewPage() {
  const params = useParams();
  const fragmentId = params?.fragmentId as string;
  const trpc = useTRPC();

  const { data, isLoading, isError } = useQuery(
    trpc.fragments.getFiles.queryOptions(
      { fragmentId: fragmentId || "" },
      { enabled: !!fragmentId, retry: false, refetchOnWindowFocus: false }
    )
  );

  useEffect(() => {
    if (data?.title) document.title = data.title;
  }, [data?.title]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center text-white">
        <Loader2Icon className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
        <MonitorXIcon className="w-10 h-10 text-red-400" />
        <h1 className="text-lg font-semibold">Preview not found</h1>
        <p className="text-sm text-white/60 max-w-sm">
          This preview doesn&apos;t exist or you don&apos;t have access to it. Make sure you&apos;re signed in to the account that owns the project.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-white">
      <HTMLPreview files={data.files} className="w-full h-full border-0" />
    </div>
  );
}
