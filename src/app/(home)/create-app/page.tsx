"use client";

import { useState, useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Starfield, AuroraBackground } from "@/components/animations/aurora-background";
import { HTMLPreview } from "@/components/html-preview";
import { 
  SparklesIcon, 
  SmartphoneIcon, 
  DownloadIcon, 
  PlusIcon, 
  PlayIcon,
  RotateCwIcon,
  HistoryIcon,
  MessageSquareIcon,
  CpuIcon,
  Maximize2,
  QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Simulated build logs for visual excellence
const SIMULATED_BUILD_LOGS = [
  "🌌 Connecting to Genetix orbit sub-systems...",
  "🛸 Allocating isolated mobile sandbox environment...",
  "🛰️ Launching cellular compiler agent...",
  "🧠 Analyzing prompt and mapping mobile requirements...",
  "🎨 Drafting responsive viewport and viewport-meta tag...",
  "🧬 Synthesizing layout grids and CSS variables...",
  "⚡ Compiling interactive touch-event listeners...",
  "🧩 Assembling index.html and inline script segments...",
  "💎 Optimizing CSS layout inside device frame...",
  "✨ App generation complete! Injecting live preview..."
];

export default function CreateAppPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logIndex, setLogIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [activeFragmentMessageId, setActiveFragmentMessageId] = useState<string | null>(null);

  // Fetch only mobile app projects (completely separate from website projects)
  const { data: appProjects, isLoading: isLoadingProjects } = useQuery(
    trpc.appProjects.getMany.queryOptions()
  );

  // Fetch user credit usage/balance
  const { data: usageStatus, refetch: refetchUsage } = useQuery(
    trpc.usage.status.queryOptions()
  );

  // Fetch messages/fragments for the selected mobile app project
  const { data: messages, refetch: refetchMessages } = useQuery(
    trpc.appProjects.getMessages.queryOptions(
      { projectId: selectedProjectId || "" },
      { enabled: !!selectedProjectId }
    )
  );

  // Reset selected fragment when project changes
  useEffect(() => {
    setActiveFragmentMessageId(null);
  }, [selectedProjectId]);

  // Find the latest message in the message list
  const latestMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;

  // The app is compiling if the latest message is from the user (waiting for AI reply/fragment)
  const isCompiling = !!(selectedProjectId && latestMessage && latestMessage.role === "USER");

  // Calculate if the selected project has a generated app code preview
  const hasFragment = !!messages?.some((m) => m.role === "ASSISTANT" && m.fragments);

  // Auto-restore compile logs when navigating back
  useEffect(() => {
    if (selectedProjectId && isCompiling && latestMessage && appProjects) {
      const elapsedMs = Date.now() - new Date(latestMessage.createdAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
      
      // Each log statement takes ~2.5s
      const logsToShowCount = Math.min(
        Math.floor(elapsedSeconds / 2.5) + 1,
        SIMULATED_BUILD_LOGS.length
      );
      
      setLogs(SIMULATED_BUILD_LOGS.slice(0, logsToShowCount));
      setLogIndex(logsToShowCount - 1);
      setIsGenerating(true);
    }
  }, [selectedProjectId, isCompiling, latestMessage, appProjects]);

  // Find all assistant messages with fragments
  const assistantMessages = messages
    ? messages.filter((m) => m.role === "ASSISTANT" && m.fragments)
    : [];

  const latestAssistantMessage = assistantMessages.length > 0
    ? assistantMessages[assistantMessages.length - 1]
    : null;

  const latestAssistantMessageId = latestAssistantMessage?.id || null;

  // Selected or active fragment
  const activeFragment = (() => {
    if (assistantMessages.length === 0) return null;
    if (activeFragmentMessageId) {
      const selectedMessage = assistantMessages.find((m) => m.id === activeFragmentMessageId);
      if (selectedMessage) return selectedMessage.fragments;
    }
    return latestAssistantMessage ? latestAssistantMessage.fragments : null;
  })();

  // Credit/Project creation mutation
  const createAppProject = useMutation(
    trpc.appProjects.create.mutationOptions({
      onSuccess: (data) => {
        setSelectedProjectId(data.id);
        setActiveFragmentMessageId(null);
        queryClient.invalidateQueries(trpc.appProjects.getMany.queryOptions());
        refetchUsage();
        // Start simulated logs animation
        setLogIndex(0);
        setLogs([SIMULATED_BUILD_LOGS[0]]);
        setIsGenerating(true);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to start generation");
        setIsGenerating(false);
      }
    })
  );

  // Project message iteration mutation
  const createAppMessage = useMutation(
    trpc.appProjects.createMessage.mutationOptions({
      onSuccess: () => {
        refetchMessages();
        setActiveFragmentMessageId(null);
        refetchUsage();
        // Start simulated logs animation
        setLogIndex(0);
        setLogs([SIMULATED_BUILD_LOGS[0]]);
        setIsGenerating(true);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to submit instruction");
        setIsGenerating(false);
      }
    })
  );

  // Handle simulated build log rotation
  useEffect(() => {
    if (isGenerating) {
      logIntervalRef.current = setInterval(() => {
        setLogIndex((prev) => {
          const next = prev + 1;
          if (next < SIMULATED_BUILD_LOGS.length) {
            setLogs((current) => [...current, SIMULATED_BUILD_LOGS[next]]);
            return next;
          } else {
            if (logIntervalRef.current) clearInterval(logIntervalRef.current);
            return prev;
          }
        });
      }, 2500);
    }

    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    };
  }, [isGenerating]);

  // Polling database for fragments while generating
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (isGenerating && selectedProjectId) {
      pollInterval = setInterval(async () => {
        const { data } = await refetchMessages();
        const hasFragment = data?.some((m) => m.role === "ASSISTANT" && m.fragments);
        if (hasFragment) {
          // Found generated preview, finish generating
          setIsGenerating(false);
          if (logIntervalRef.current) clearInterval(logIntervalRef.current);
          toast.success("🚀 App generated successfully!");
        }
      }, 2000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isGenerating, selectedProjectId, refetchMessages]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    // Direct the AI agent to explicitly produce mobile-first responsive code
    const mobileGuidelines = `
[STRICT MOBILE-FIRST REQUIREMENTS]:
1. The user wants a mobile-optimized standalone screen/application.
2. Ensure the code uses viewport-meta scale-to-fit properly.
3. Design a single-column layout fit specifically for a smartphone screen (compact card lists, vertical navigation, bottom navigation bars, full-screen touch targets, mobile menus, and minimal margins).
4. Do NOT use horizontal wide desktop sections (no wide columns, no sidebars).
5. All buttons and interactive elements must feel touch-friendly and fit within standard vertical smartphone viewport constraints.
    `;

    const payload = {
      value: prompt,
      enhancedValue: `${prompt}\n\n${mobileGuidelines}`
    };

    if (selectedProjectId) {
      createAppMessage.mutate({
        projectId: selectedProjectId,
        value: payload.value,
        enhancedValue: payload.enhancedValue
      });
    } else {
      createAppProject.mutate(payload);
    }
    
    // Clear prompt input box after sending
    setPrompt("");
  };

  return (
    <div className="relative min-h-[calc(100vh-68px)] w-full text-white overflow-hidden pt-16 flex flex-col md:flex-row">
      {/* Space backgrounds */}
      <div className="absolute inset-0 bg-black -z-20" />
      <div className="absolute inset-0 -z-10 opacity-70">
        <Starfield count={80} />
        <AuroraBackground />
      </div>

      {/* Sidebar: Mobile App Projects */}
      <aside className="w-full md:w-80 border-r border-white/10 bg-black/40 backdrop-blur-md p-6 flex flex-col z-10 shrink-0 font-[Orbitron]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-md font-bold tracking-wider flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-purple-400" />
            My Mobile Apps
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedProjectId(null);
              setPrompt("");
              setIsGenerating(false);
            }}
            className="h-8 w-8 p-0 rounded-full bg-white/5 hover:bg-white/10"
            title="Create New App"
          >
            <PlusIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Credit balance display card */}
        {usageStatus && (
          <div className="mb-6 p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs backdrop-blur-md">
            <span className="text-white/60 font-sans">Credit Balance:</span>
            <span className="font-bold text-purple-400">{usageStatus.remainingCredits} Credits</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] md:max-h-none pr-1">
          {isLoadingProjects ? (
            <div className="text-sm text-white/50 text-center py-4">Loading...</div>
          ) : appProjects && appProjects.length > 0 ? (
            appProjects.map((proj) => (
              <button
                key={proj.id}
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setIsGenerating(false);
                }}
                className={`w-full p-3 rounded-xl border text-left transition-all duration-300 flex items-center justify-between group ${
                  selectedProjectId === proj.id
                    ? "bg-purple-950/40 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                }`}
              >
                <div className="truncate pr-2">
                  <p className="text-xs font-semibold text-white truncate">{proj.name}</p>
                  <p className="text-[10px] text-white/40 mt-1">
                    {new Date(proj.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <SmartphoneIcon className={`w-3.5 h-3.5 shrink-0 ${selectedProjectId === proj.id ? "text-purple-400" : "text-white/30 group-hover:text-white/60"}`} />
              </button>
            ))
          ) : (
            <div className="text-xs text-white/30 text-center py-8">No app projects created yet.</div>
          )}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-10 flex flex-col lg:flex-row gap-8 items-stretch z-10 min-w-0">
        
        {/* Left Side: Creation Form / Build Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            {!selectedProjectId ? (
              // Prompt Input screen
              <motion.div
                key="prompt-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex-1 flex flex-col justify-center space-y-6"
              >
                <div className="space-y-2">
                  <h1 className="text-3xl md:text-4xl font-extrabold font-[Orbitron] tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                    Create Mobile App 📱
                  </h1>
                  <p className="text-sm text-white/70 max-w-xl font-[Orbitron]">
                    Describe your application idea below. Genetix will automatically generate the code and optimize it specifically for a smartphone layout.
                  </p>
                </div>

                <div className="p-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl shadow-2xl space-y-4">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={8}
                    placeholder="e.g. A fully interactive BMI Calculator with animated weight gauges, history logs, advice based on score, and a sleek neon cyberpunk layout."
                    className="bg-black/50 border-white/15 focus:border-purple-500/50 rounded-2xl p-4 font-[Orbitron] text-sm resize-none"
                  />
                  <div className="text-[10px] text-white/50 font-[Orbitron] flex items-center justify-between px-1">
                    <span>⚡ Generation Cost: <span className="text-purple-400 font-bold">5 Credits</span></span>
                    {usageStatus && (
                      <span>Available Balance: <span className="text-purple-400 font-bold">{usageStatus.remainingCredits} Credits</span></span>
                    )}
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || createAppProject.isPending}
                    className="w-full h-12 bg-white text-black hover:bg-white/90 font-[Orbitron] font-bold tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300"
                  >
                    <SparklesIcon className="w-4 h-4 text-purple-600 fill-purple-600/30" />
                    {createAppProject.isPending ? "Starting Engine..." : "Generate Mobile App"}
                  </Button>
                </div>
              </motion.div>
            ) : (isGenerating || isCompiling) ? (
              // Build Terminal Logs Screen
              <motion.div
                key="terminal-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-center"
              >
                <div className="p-6 border border-white/10 rounded-3xl bg-black/60 backdrop-blur-2xl shadow-3xl font-mono text-xs text-purple-300 space-y-4 h-[400px] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-white/15 font-[Orbitron]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                    <span className="text-[10px] text-white/40 uppercase font-bold">Genetix App Builder Terminal</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none scrollbar-thin">
                    {logs.map((log, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {log}
                      </motion.div>
                    ))}
                    <div className="flex items-center gap-1.5 mt-2 text-white/50">
                      <CpuIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating code assets... Please wait</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              // Active Project View (Summary & Prompt input to iterate)
              <motion.div
                key="project-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedProjectId(null);
                        setPrompt("");
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white rounded-full p-2 h-9 w-9"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </Button>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 font-[Orbitron]">Mobile Application</span>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold font-[Orbitron] text-white">
                          {appProjects?.find((p) => p.id === selectedProjectId)?.name || "App Project"}
                        </h2>
                        <Button
                          size="sm"
                          onClick={() => setIsZoomed(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-8 px-3 font-[Orbitron] text-[10px] font-bold tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.3)] border border-purple-400/30"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          Zoom Screen
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setIsQrZoomed(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-8 px-3 font-[Orbitron] text-[10px] font-bold tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.3)] border border-purple-400/30"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          QR Scan
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Show messages history */}
                  <div className="border border-white/10 rounded-3xl p-6 bg-white/5 backdrop-blur-xl h-[350px] overflow-y-auto space-y-4">
                    {messages && messages.length > 0 ? (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex gap-3 max-w-[85%] ${
                            m.role === "USER" ? "ml-auto flex-row-reverse" : "mr-auto"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                              m.role === "USER"
                                ? "bg-white text-black"
                                : "bg-purple-600 text-white"
                            }`}
                          >
                            {m.role === "USER" ? "ME" : "GX"}
                          </div>
                          <div
                            className={`p-3.5 rounded-2xl text-xs font-[Orbitron] leading-relaxed ${
                              m.role === "USER"
                                ? "bg-white/10 border border-white/10 text-white rounded-tr-none"
                                : "bg-purple-950/20 border border-purple-500/20 text-purple-200 rounded-tl-none"
                            }`}
                          >
                            {m.content}

                            {m.role === "ASSISTANT" && m.fragments && (
                              <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center justify-between gap-4">
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                                  {m.fragments.title || "Version Fragment"}
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => setActiveFragmentMessageId(m.id)}
                                  className={`h-7 px-3 rounded-lg font-bold text-[9px] font-[Orbitron] tracking-wider transition-all duration-300 ${
                                    activeFragmentMessageId === m.id || (!activeFragmentMessageId && m.id === latestAssistantMessageId)
                                      ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-white/80"
                                  }`}
                                >
                                  {activeFragmentMessageId === m.id || (!activeFragmentMessageId && m.id === latestAssistantMessageId)
                                    ? "Active Preview"
                                    : "View Version"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-white/30 text-center py-12">No messages loaded.</div>
                    )}
                  </div>
                </div>

                {/* Iteration Prompt box */}
                <div className="space-y-2">
                  <div className="p-4 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-md flex gap-2">
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ask AI to modify or add screens to your app..."
                      rows={2}
                      className="bg-black/40 border-white/10 rounded-2xl text-xs focus:border-purple-500/40 resize-none font-[Orbitron] py-2"
                    />
                    <Button
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || createAppProject.isPending}
                      className="bg-white text-black hover:bg-white/90 font-[Orbitron] font-bold text-xs rounded-2xl px-4 cursor-pointer"
                    >
                      Send
                    </Button>
                  </div>
                  <div className="text-[10px] text-white/50 font-[Orbitron] flex items-center justify-between px-2">
                    <span>⚡ Generation Cost: <span className="text-purple-400 font-bold">5 Credits</span></span>
                    {usageStatus && (
                      <span>Available Balance: <span className="text-purple-400 font-bold">{usageStatus.remainingCredits} Credits</span></span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Real Phone Mockup Preview */}
        <div className="w-full lg:w-[360px] flex flex-col items-center justify-center shrink-0">
          <div className="relative w-[300px] h-[600px] rounded-[50px] border-[12px] border-neutral-800 bg-neutral-950 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(168,85,247,0.15)] overflow-hidden flex flex-col ring-1 ring-neutral-700/50">
            {/* Phone Notch/Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-neutral-900 rounded-full z-30 flex items-center justify-end px-4 gap-1.5 border border-black/40 shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-blue-900/60" />
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-950/70" />
            </div>

            {/* Phone Bezel Top Status Bar */}
            <div className="h-10 bg-black w-full flex items-center justify-between px-6 text-[10px] font-bold text-white/80 select-none z-20 font-sans">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>

            <div className="flex-1 bg-neutral-900 relative overflow-hidden">
              {(isGenerating || isCompiling) ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <SmartphoneIcon className="w-6 h-6 text-purple-400 absolute" />
                  </div>
                  <p className="text-xs font-[Orbitron] text-purple-300">Assembling APK preview...</p>
                </div>
              ) : activeFragment ? (
                <HTMLPreview
                  files={activeFragment.files as { [path: string]: string }}
                  className="w-full h-full"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 p-6 text-center space-y-4">
                  <SmartphoneIcon className="w-10 h-10 text-white/20 animate-bounce" />
                  <p className="text-xs text-white/40 font-[Orbitron]">Your app preview will render inside this smartphone screen.</p>
                </div>
              )}
            </div>

            {/* Phone Home Indicator Bar */}
            <div className="h-6 bg-black w-full flex items-center justify-center z-20">
              <div className="w-28 h-1 bg-white/30 rounded-full" />
            </div>
          </div>

          {/* Action Row below the phone frame */}
          <div className="mt-6 flex flex-col items-center gap-4 w-full">
            <div className="flex gap-3 items-center justify-center w-full">
              {/* Zoom Button */}
              <Button
                onClick={() => setIsZoomed(true)}
                className="w-28 h-11 border border-purple-500/30 bg-purple-950/20 text-purple-300 rounded-full font-[Orbitron] font-bold text-xs flex items-center justify-center gap-2 hover:bg-purple-900/30 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Zoom App
              </Button>

              {/* Download APK option */}
              <div className="relative group">
                <Button
                  disabled
                  className="w-28 h-11 border border-purple-500/30 bg-purple-950/20 text-purple-300 rounded-full font-[Orbitron] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  APK
                </Button>
                <span className="absolute -top-3 right-0 bg-gradient-to-r from-pink-500 to-red-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full rotate-12 select-none border border-black/20 shadow-md">
                  Soon
                </span>
              </div>
            </div>

            {/* QR Code Card */}
            {activeFragment && selectedProjectId && (
              <div 
                onClick={() => setIsQrZoomed(true)}
                className="flex flex-col items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-2xl w-full max-w-[280px] backdrop-blur-md cursor-pointer hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 group"
              >
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=a855f7&data=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/preview/${selectedProjectId}`
                      : ""
                  )}`} 
                  alt="Scan to open on phone" 
                  className="w-28 h-28 rounded-lg bg-white p-1 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-105 transition-transform duration-300"
                />
                <span className="text-[10px] font-bold text-purple-300 font-[Orbitron] tracking-wider uppercase flex items-center gap-1 group-hover:text-purple-200">
                  <Maximize2 className="w-2.5 h-2.5" /> Scan to Run on Phone
                </span>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Zoomed Phone Preview Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4"
            onClick={() => setIsZoomed(false)}
          >
            {/* Close button */}
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setIsZoomed(false)}
              className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all duration-300 cursor-pointer shadow-2xl z-50 font-[Orbitron]"
            >
              <span className="text-xl">✕</span>
            </motion.button>

            {/* Phone container - scaled up to fit the screen */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-[340px] sm:w-[380px] h-[720px] sm:h-[780px] rounded-[55px] border-[14px] border-neutral-800 bg-neutral-950 shadow-[0_30px_70px_rgba(0,0,0,0.8),0_0_50px_rgba(168,85,247,0.3)] overflow-hidden flex flex-col ring-1 ring-neutral-700/50"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the phone itself
            >
              {/* Phone Notch/Dynamic Island */}
              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-32 h-6.5 bg-neutral-900 rounded-full z-30 flex items-center justify-end px-4 gap-1.5 border border-black/40 shadow-inner">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-900/60" />
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-950/70" />
              </div>

              {/* Phone Bezel Top Status Bar */}
              <div className="h-10 bg-black w-full flex items-center justify-between px-7 text-[10px] font-bold text-white/80 select-none z-20 font-sans">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <span>📶</span>
                  <span>🔋</span>
                </div>
              </div>

              <div className="flex-1 bg-neutral-900 relative overflow-hidden">
                {(isGenerating || isCompiling) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center space-y-4">
                    <div className="relative flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                      <SmartphoneIcon className="w-6 h-6 text-purple-400 absolute" />
                    </div>
                    <p className="text-xs font-[Orbitron] text-purple-300">Assembling APK preview...</p>
                  </div>
                ) : activeFragment ? (
                  <HTMLPreview
                    files={activeFragment.files as { [path: string]: string }}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 p-6 text-center space-y-4">
                    <SmartphoneIcon className="w-10 h-10 text-white/20 animate-bounce" />
                    <p className="text-xs text-white/40 font-[Orbitron]">Your app preview will render inside this smartphone screen.</p>
                  </div>
                )}
              </div>

              {/* Phone Home Indicator Bar */}
              <div className="h-6 bg-black w-full flex items-center justify-center z-20">
                <div className="w-28 h-1 bg-white/30 rounded-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoomed QR Code Modal */}
      <AnimatePresence>
        {isQrZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4"
            onClick={() => setIsQrZoomed(false)}
          >
            {/* Close button */}
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setIsQrZoomed(false)}
              className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all duration-300 cursor-pointer shadow-2xl z-50 font-[Orbitron]"
            >
              <span className="text-xl">✕</span>
            </motion.button>

            {/* QR Card Container */}
            {activeFragment && selectedProjectId && (
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="p-8 border border-purple-500/30 rounded-3xl bg-neutral-950/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_50px_rgba(168,85,247,0.2)] flex flex-col items-center gap-6 max-w-sm w-full text-center ring-1 ring-neutral-700/50"
                onClick={(e) => e.stopPropagation()} // Prevent close
              >
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=a855f7&data=${encodeURIComponent(
                      typeof window !== "undefined"
                        ? `${window.location.origin}/preview/${selectedProjectId}`
                        : ""
                    )}`} 
                    alt="Scan to open on phone" 
                    className="relative w-64 h-64 rounded-xl bg-white p-3 border border-purple-500/40 shadow-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold font-[Orbitron] text-white tracking-wide uppercase">Scan to Run on Phone</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-sans px-2">
                    Open your smartphone's camera or QR reader to scan this code. The application will load instantly fullscreen.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
