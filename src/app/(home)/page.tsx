"use client";
import ProjectsList from "./ProjectsList";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "next-auth/react";
import { getTemplateById } from "@/lib/templates";
import type { Template } from "@/lib/templates";

function TypingTitle() {
  const fullText = "Build With Genetix";
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, []);
  return (
    <h1 className="text-white text-5xl md:text-6xl font-extrabold tracking-widest font-[Orbitron] drop-shadow-xl">
      {displayed}
      <span className="animate-blink">|</span>
      <style jsx>{`
        .animate-blink {
          animation: blink 1s steps(2, start) infinite;
        }
        @keyframes blink {
          to { opacity: 0; }
        }
      `}</style>
    </h1>
  );
}

const Page = () => {
  const [value, setValue] = useState("");
  const [selectedTech, setSelectedTech] = useState("html-css-js");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumbTop, setScrollThumbTop] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const router = useRouter();
  const trpc = useTRPC();
  const { user } = useAuth();
  const { data: session } = useSession();
  
  // Get display name from either auth method
  const displayName = user?.firstName || user?.username || session?.user?.name || 'USER';
  const isLoggedIn = !!(user || session?.user);
  
  // Technology stack options
  const techOptions = [
    { value: "react-nextjs", label: "React + Next.js", description: "Modern web apps with React and Next.js" },
    { value: "html-css-js", label: "HTML + CSS + JavaScript", description: "Vanilla web development" },
    { value: "vue-nuxt", label: "Vue.js + Nuxt", description: "Vue-based web applications" },
    { value: "angular", label: "Angular", description: "Enterprise web applications" },
    { value: "svelte-kit", label: "Svelte + SvelteKit", description: "Fast and lightweight apps" },
  ];
  // ...existing code...
  const queryClient = useQueryClient();
  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
        if (error.data?.code === "UNAUTHORIZED") {
          router.push("/auth/signin");
        }
        if (error.data?.code === "TOO_MANY_REQUESTS") {
          router.push("/pricing");
        }
      },
      onSuccess: (data) => {
        // Invalidate queries in background (don't await)
        queryClient.invalidateQueries(
          trpc.projects.getMany.queryOptions(),
        );
        queryClient.invalidateQueries(
          trpc.usage.status.queryOptions()
        );
        
        // Show loading toast and redirect immediately
        toast.loading("Creating your project...", { id: "project-create" });
        router.push(`/projects/${data.id}`);
        
        // Clear the loading toast after redirect
        setTimeout(() => {
          toast.dismiss("project-create");
          toast.success("🚀 Project created! AI is generating your code...");
        }, 500);
      },
    })
  );

  const handleCreateProject = () => {
    const selectedTechOption = techOptions.find(tech => tech.value === selectedTech);
    
    let enhancedPrompt = value;
    
    // If template is selected, merge template design with user prompt
    if (selectedTemplate) {
      enhancedPrompt = `${selectedTemplate.designPrompt}\n\n=== USER REQUIREMENTS ===\n${value}`;
    }
    
    // Add technology stack information
    enhancedPrompt += `\n\nTechnology Stack: ${selectedTechOption?.label}\nRequirements: ${selectedTechOption?.description}`;
    
    createProject.mutate({ 
      value: value, // Original prompt for display
      enhancedValue: enhancedPrompt, // Enhanced prompt with template design
      techStack: selectedTech,
      templateId: selectedTemplate?.id // Pass template ID if selected
    });
  };

  useEffect(() => {
    // Prefill from ?prompt= and ?template= (client-only to avoid Suspense requirement)
    try {
      const usp = new URLSearchParams(window.location.search);
      const p = usp.get("prompt");
      if (p) setValue(p);
      
      const templateId = usp.get("template");
      if (templateId) {
        const template = getTemplateById(templateId);
        if (template) {
          setSelectedTemplate(template);
          toast.success(`Template "${template.name}" selected!`);
        }
      }
    } catch {}

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
  }, []);

  return (
    <main className="min-h-screen w-full bg-black overflow-x-hidden relative">
      {/* Animated Stars & Nebula Background */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        {/* Stars */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          {[...Array(80)].map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white opacity-70 animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 2 + 1}px`,
                height: `${Math.random() * 2 + 1}px`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
        {/* Nebula (CSS keyframes) */}
        <div className="absolute left-1/2 top-1/2 w-[900px] h-[600px] -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-700 via-blue-700 to-pink-500 opacity-30 blur-3xl animate-nebula" />
        </div>
      </div>

      {/* Custom Scroll Indicator (SSR-safe) */}
      <div className="fixed top-0 right-2 w-1 h-full bg-transparent z-50 pointer-events-none">
        <div className="w-full h-full bg-white/10 rounded-full" />
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
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center pt-20 pb-19 px-4">
          {/* Header Section */}
          <div className="text-center mb-16">
            {isLoggedIn && (
              <p className="text-green-400 text-sm md:text-base font-[Orbitron] tracking-[0.3em] mb-8 uppercase" 
                 style={{ textShadow: '0 0 10px rgba(74, 222, 128, 0.8), 0 0 20px rgba(74, 222, 128, 0.5)' }}>
                WELCOME, {displayName}
              </p>
            )}
            <TypingTitle />
            <p className="text-gray-300 mt-6 text-base md:text-xl font-light">
              Your imagination. AI execution. 🚀
            </p>
            
            {/* Templates Button */}
            <div className="mt-8">
              <Button
                onClick={() => router.push('/templates')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-bold font-[Orbitron] transition shadow-lg hover:shadow-purple-500/50"
              >
                ✨ Browse Templates
              </Button>
            </div>
          </div>
          
          {/* Selected Template Display */}
          {selectedTemplate && (
            <div className="backdrop-blur-md bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 shadow-xl px-6 py-4 w-full mb-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-purple-300 text-xs font-[Orbitron] uppercase tracking-wider mb-1">Selected Template</p>
                  <h3 className="text-white font-bold text-lg font-[Orbitron]">{selectedTemplate.name}</h3>
                  <p className="text-gray-300 text-sm mt-1">{selectedTemplate.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {selectedTemplate.category}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSelectedTemplate(null);
                    toast.info("Template cleared");
                  }}
                  variant="outline"
                  className="text-white bg-white/10 hover:bg-red-500/20 border border-white/30 hover:border-red-500 px-4 py-2 transition font-[Orbitron] ml-4"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
          {/* Input + Prompts Section */}
          <div className="backdrop-blur-md bg-black/40 border border-gray-700 shadow-2xl px-8 py-8 w-full text-center space-y-6 mt-1">
            {/* Technology Stack Selector */}
            <div className="w-full">
              <label className="block text-white/80 text-sm font-[Orbitron] mb-3 text-left">
                🔧 Select Technology Stack
              </label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger className="w-full bg-black/40 border border-white/30 text-white font-[Orbitron] rounded-xl focus:ring-2 focus:ring-white">
                  <SelectValue placeholder="Choose your tech stack" />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border border-white/30 rounded-xl">
                  {techOptions.map((tech) => (
                    <SelectItem 
                      key={tech.value} 
                      value={tech.value}
                      className="text-white hover:bg-white/10 font-[Orbitron] focus:bg-white/10"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">{tech.label}</span>
                        <span className="text-xs text-white/60">{tech.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <div className="relative flex-1 flex">
                <textarea
                  className="bg-black/40 border border-white/30 placeholder:text-gray-400 text-white px-4 py-3 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-white font-[Orbitron] [&::selection]:bg-white [&::selection]:text-black resize-none w-full"
                  placeholder="🌑 e.g. Build a crypto dashboard with real-time updates"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  rows={4}
                  style={{ minHeight: '50px', maxHeight: '120px' }}
                />
                <button
                  type="button"
                  aria-label={listening ? "Listening..." : "Speak"}
                  className={`absolute right-3 top-3 p-0 m-0 bg-transparent border-none outline-none flex items-center justify-center transition ${listening ? "animate-pulse" : ""}`}
                  style={{height: '32px', width: '32px'}}
                  onClick={() => {
                    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                      alert('Speech recognition not supported in this browser.');
                      return;
                    }
                    if (listening) {
                      recognitionRef.current?.stop();
                      setListening(false);
                      return;
                    }
                    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.lang = 'en-US';
                    recognition.interimResults = false;
                    recognition.maxAlternatives = 1;
                    recognition.onresult = (event: any) => {
                      const transcript = event.results[0][0].transcript;
                      setValue(prev => prev ? prev + ' ' + transcript : transcript);
                      setListening(false);
                    };
                    recognition.onerror = () => {
                      setListening(false);
                    };
                    recognition.onend = () => {
                      setListening(false);
                    };
                    recognitionRef.current = recognition;
                    recognition.start();
                    setListening(true);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3m0 0h-3m3 0h3m-3-3a6 6 0 006-6V9a6 6 0 10-12 0v3a6 6 0 006 6z" />
                  </svg>
                </button>
              </div>
              <Button
                disabled={createProject.isPending || !value}
                onClick={handleCreateProject}
                className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-bold font-[Orbitron] transition mt-2 sm:mt-0"
              >
                Launch 🚀
              </Button>
            </div>
            {value && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-left">
                <span className="text-xs sm:text-sm text-white/80 font-[Orbitron]">Need help crafting this? Get a concise, better prompt.</span>
                <Button
                  variant="outline"
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 px-4 py-2 transition font-[Orbitron]"
                  onClick={() => {
                    const qs = new URLSearchParams({ idea: value }).toString();
                    router.push(`/prompt-generator?${qs}`);
                  }}
                >
                  Enhance this prompt
                </Button>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {/* Dynamic prompts based on selected technology */}
              {selectedTech === "react-nextjs" && [
                "Create a landing page", "Build Admin Dashboard", "Create Kanban Board", "Build E-commerce Site"
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setValue(prompt)}
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 rounded-full px-4 py-2 transition font-[Orbitron]"
                >
                  {prompt}
                </Button>
              ))}
              
              {selectedTech === "html-css-js" && [
                "Create netflix clone", "Build Portfolio Website", "Create tic tac toe game", "Build rock paper scissor game"
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setValue(prompt)}
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 rounded-full px-4 py-2 transition font-[Orbitron]"
                >
                  {prompt}
                </Button>
              ))}
              
              {selectedTech === "vue-nuxt" && [
                "Create Dashboard", "Build Portfolio Site", "Create Blog Platform", "Build E-commerce App"
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setValue(prompt)}
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 rounded-full px-4 py-2 transition font-[Orbitron]"
                >
                  {prompt}
                </Button>
              ))}
              
              {selectedTech === "angular" && [
                "Create Admin Panel", "Build Task Manager", "Create Data Visualization", "Build Enterprise App"
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setValue(prompt)}
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 rounded-full px-4 py-2 transition font-[Orbitron]"
                >
                  {prompt}
                </Button>
              ))}
              
              {selectedTech === "svelte-kit" && [
                "Create Fast Website", "Build Interactive App", "Create Minimalist Design", "Build Lightweight Tool"
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setValue(prompt)}
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 rounded-full px-4 py-2 transition font-[Orbitron]"
                >
                  {prompt}
                </Button>
              ))}
              
              {/* Default fallback for other technologies */}
              {!["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"].includes(selectedTech) && [
                "Create Web Application", "Build Dashboard", "Create API", "Build User Interface"
              ].map((prompt) => (
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

      {/* Keyframes for stars and nebula */}
      <style jsx global>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .animate-twinkle {
          animation: twinkle 2.5s infinite ease-in-out;
        }
        @keyframes nebula {
          0% { transform: scale(1) rotate(0deg); filter: blur(60px); }
          50% { transform: scale(1.08) rotate(8deg); filter: blur(80px); }
          100% { transform: scale(1) rotate(0deg); filter: blur(60px); }
        }
        .animate-nebula {
          animation: nebula 18s linear infinite;
        }
        @keyframes led-glow {
          0% { 
            color: #4ade80; 
            text-shadow: 0 0 5px #4ade80, 0 0 10px #4ade80, 0 0 15px #4ade80;
          }
          25% { 
            color: #22c55e; 
            text-shadow: 0 0 8px #22c55e, 0 0 16px #22c55e, 0 0 24px #22c55e;
          }
          50% { 
            color: #16a34a; 
            text-shadow: 0 0 12px #16a34a, 0 0 24px #16a34a, 0 0 36px #16a34a;
          }
          75% { 
            color: #22c55e; 
            text-shadow: 0 0 8px #22c55e, 0 0 16px #22c55e, 0 0 24px #22c55e;
          }
          100% { 
            color: #4ade80; 
            text-shadow: 0 0 5px #4ade80, 0 0 10px #4ade80, 0 0 15px #4ade80;
          }
        }
        .animate-led-glow {
          animation: led-glow 2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
export default Page;