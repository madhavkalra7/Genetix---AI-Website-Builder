"use client";
import ProjectsList from "./ProjectsList";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClerk } from "@clerk/nextjs";

const Page = () => {
  const [value, setValue] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumbTop, setScrollThumbTop] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
        if (error.data?.code === "UNAUTHORIZED") {
          clerk.openSignIn();
        }
        if (error.data?.code === "TOO_MANY_REQUESTS") {
          router.push("/pricing");
        }
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          trpc.projects.getMany.queryOptions(),
        );
        queryClient.invalidateQueries(
          trpc.usage.status.queryOptions()
        );
        toast.success("🚀 Project created");
        router.push(`/projects/${data.id}`);
      },
    })
  );

  // Custom scroll progress tracker (SSR-safe)
  useEffect(() => {
  // Prefill from ?prompt=
  const p = searchParams?.get("prompt");
  if (p) setValue(p);

    const updateScrollProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      setScrollProgress(progress);
      // Calculate thumb position
      const thumbTop = progress * Math.max(0, window.innerHeight - 60);
      setScrollThumbTop(thumbTop);
    };
    updateScrollProgress();
    window.addEventListener('scroll', updateScrollProgress);
    window.addEventListener('resize', updateScrollProgress);
    return () => {
      window.removeEventListener('scroll', updateScrollProgress);
      window.removeEventListener('resize', updateScrollProgress);
    };
  }, [searchParams]);

  return (
    <main className="min-h-screen w-full bg-black overflow-x-hidden">
      {/* Custom Scroll Indicator (SSR-safe) */}
      <div className="fixed top-0 right-2 w-1 h-full bg-transparent z-50 pointer-events-none">
        {/* Track */}
        <div className="w-full h-full bg-white/10 rounded-full" />
        {/* Thumb */}
        <div 
          className="absolute w-full bg-white/50 rounded-full transition-all duration-200 ease-out"
          style={{ 
            height: '60px',
            top: `${scrollThumbTop}px`
          }}
        />
      </div>

      {/* Hero Section */}
      <section
        className="relative w-full flex flex-col items-center justify-center bg-center bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/moon.jpg')",
          minHeight: "110vh",
        }}
      >
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center pt-13 pb-19 px-4">
          {/* Header Section */}
          <div className="text-center mb-50">
            <h1 className="text-white text-5xl md:text-6xl font-extrabold tracking-widest font-[Orbitron] drop-shadow-xl">
              Build With <span className="text-white/80">Genetix</span>
            </h1>
            <p className="text-gray-300 mt-4 text-sm md:text-lg font-light">
              Your imagination. AI execution. 🚀
            </p>
          </div>
          {/* Input + Prompts Section */}
          <div className="backdrop-blur-md bg-black/40 border border-gray-700 shadow-2xl px-8 py-8 w-full text-center space-y-6 mt-1">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                className="bg-black/40 border border-white/30 placeholder:text-gray-400 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-white font-[Orbitron] [&::selection]:bg-white [&::selection]:text-black"
                placeholder="🌑 e.g. Build a crypto dashboard"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Button
                disabled={createProject.isPending || !value}
                onClick={() => createProject.mutate({ value })}
                className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-bold font-[Orbitron] transition"
              >
                Launch 🚀
              </Button>
            </div>
            {/* Demo Prompts */}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {["Create Netflix Clone","Build Admin Dashboard","create Kanban Board","create Calculator","Build E-commerce Site","Build Sudoku Solver",].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setValue(prompt)}
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 rounded-full px-4 py-2 transition font-[Orbitron]"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* Projects List Section */}
      <section className="w-full bg-black py-12">
        <div className="w-full max-w-3xl mx-auto px-4">
          <ProjectsList />
        </div>
      </section>
    </main>
  );
};

export default Page;