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
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { FadeIn } from "@/components/animations/fade-in";
import { TextReveal } from "@/components/animations/text-reveal";
import { SpotlightCard } from "@/components/animations/spotlight-card";
import { Magnetic } from "@/components/animations/magnetic-button";
import { AuroraBackground, Starfield } from "@/components/animations/aurora-background";
const Page = () => {
  const [value, setValue] = useState("");
  const [selectedTech, setSelectedTech] = useState("html-css-js");
  const [advancedReasoning, setAdvancedReasoning] = useState(false);
  const [canUseAdvanced, setCanUseAdvanced] = useState(false); // Start with false until API check completes
  const [hoursRemaining, setHoursRemaining] = useState(0);
  const [showModelPopup, setShowModelPopup] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollThumbTop, setScrollThumbTop] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const moonY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.35]);
  const router = useRouter();
  const trpc = useTRPC();
  const { user } = useAuth();
  const { data: session } = useSession();
  const { t } = useLanguage();
  
  // Get display name from either auth method
  const displayName = user?.firstName || user?.username || session?.user?.name || 'USER';
  const isLoggedIn = !!(user || session?.user);
  // Technology stack options
  const techOptions = [
    { value: "react-nextjs", label: t('tech.react'), description: t('tech.reactDesc') },
    { value: "html-css-js", label: t('tech.html'), description: t('tech.htmlDesc') },
    { value: "vue-nuxt", label: t('tech.vue'), description: t('tech.vueDesc') },
    { value: "angular", label: t('tech.angular'), description: t('tech.angularDesc') },
    { value: "svelte-kit", label: t('tech.svelte'), description: t('tech.svelteDesc') },
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
      templateId: selectedTemplate?.id, // Pass template ID if selected
      advancedReasoning: selectedTech === "html-css-js" && advancedReasoning // Only for HTML/CSS/JS
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
    
    // Check if user can use Advanced Reasoning (24-hour limit)
    const checkAdvancedReasoningAvailability = async () => {
      if (isLoggedIn) {
        try {
          console.log("🔍 Checking Advanced Reasoning availability...");
          const response = await fetch('/api/check-advanced-reasoning');
          const data = await response.json();
          console.log("📊 API Response:", data);
          setCanUseAdvanced(data.available);
          setHoursRemaining(data.hoursRemaining || 0);
          console.log("✅ Set canUseAdvanced:", data.available, "hoursRemaining:", data.hoursRemaining);
        } catch (error) {
          console.error('❌ Failed to check advanced reasoning availability:', error);
          setCanUseAdvanced(true); // Default to available on error
        }
      } else {
        console.log("ℹ️ User not logged in, setting available to true");
        setCanUseAdvanced(true);
      }
    };
    checkAdvancedReasoningAvailability();

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
  }, [isLoggedIn]);

  return (
    <main className="min-h-screen w-full bg-black overflow-x-hidden relative">
      {/* Animated Stars & Aurora Background */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        <Starfield count={70} />
        <AuroraBackground />
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
        ref={heroRef}
        className="relative w-full flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "110vh" }}
      >
        {/* Parallax moon backdrop */}
        <motion.div
          className="absolute inset-0 bg-center bg-cover bg-no-repeat will-change-transform"
          style={{ backgroundImage: "url('/moon.jpg')", y: moonY, scale: 1.1, opacity: heroOpacity }}
        />
        {/* Deep vignette for readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black to-transparent" />

        <div className="relative w-full max-w-3xl mx-auto flex flex-col items-center pt-20 pb-19 px-4">
          {/* Header Section */}
          <div className="text-center mb-16">
            {isLoggedIn && (
              <motion.p
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-green-400 text-sm md:text-base font-[Orbitron] tracking-[0.3em] mb-8 uppercase animate-led-glow"
              >
                {t('home.welcome')}, {displayName}
              </motion.p>
            )}
            <TextReveal
              text={t('home.title')}
              className="text-shimmer text-5xl md:text-6xl font-extrabold tracking-widest font-[Orbitron] drop-shadow-xl"
            />
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-gray-300 mt-6 text-base md:text-xl font-light"
            >
              {t('home.subtitle')}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 text-sm md:text-base text-white/70 max-w-2xl mx-auto"
            >
              Genetix is an AI website builder that converts natural-language prompts into
              production-ready, deployable source code with real images and responsive layouts.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <SpotlightCard className="mt-8 w-full max-w-2xl mx-auto px-6 py-4 text-left">
                <p className="text-white/90 text-sm font-[Orbitron] tracking-wide">
                  Key takeaways
                </p>
                <ul className="mt-3 list-disc pl-5 text-sm text-white/70 space-y-1">
                  <li>Supports 5 stacks: React/Next.js, HTML/CSS/JS, Vue/Nuxt, Angular, SvelteKit.</li>
                  <li>Generates editable, ownership-friendly source code you can deploy anywhere.</li>
                  <li>Built for real projects with templates, responsive layouts, and live previews.</li>
                </ul>
              </SpotlightCard>
            </motion.div>

            {/* Templates Button */}
            <motion.div
              className="mt-8 inline-block"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Magnetic>
                <Button
                  onClick={() => router.push('/templates')}
                  className="btn-shine bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-bold font-[Orbitron] transition shadow-lg hover:shadow-purple-500/50"
                >
                  {t('home.browseTemplates')}
                </Button>
              </Magnetic>
            </motion.div>
          </div>

          {/* Selected Template Display */}
          <AnimatePresence>
            {selectedTemplate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="backdrop-blur-md bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 shadow-xl px-6 py-4 w-full mb-6 rounded-xl"
              >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-purple-300 text-xs font-[Orbitron] uppercase tracking-wider mb-1">{t('home.selectedTemplate')}</p>
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
                  {t('home.clear')}
                </Button>
              </div>
            </motion.div>
            )}
          </AnimatePresence>
          {/* Input + Prompts Section */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
            className="gradient-border backdrop-blur-xl shadow-2xl shadow-purple-900/20 px-8 py-8 w-full text-center space-y-6 mt-1 rounded-2xl"
          >
            {/* Technology Stack Selector */}
            <div className="w-full">
              <label className="block text-white/80 text-sm font-[Orbitron] mb-3 text-left">
                {t('home.selectTech')}
              </label>
              <Select value={selectedTech} onValueChange={(value) => {
                setSelectedTech(value);
                // Reset advanced reasoning when changing tech stack
                if (value !== "html-css-js") {
                  setAdvancedReasoning(false);
                }
              }}>
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
            
            {/* AI Model Selection Button (only for HTML/CSS/JS) */}
            {selectedTech === "html-css-js" && (
              <div className="relative w-full">
                {/* Compact Round Button */}
                <button
                  type="button"
                  onClick={() => setShowModelPopup(!showModelPopup)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/40 rounded-full hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-200"
                >
                  <span className="text-white text-sm font-[Orbitron]">
                    {advancedReasoning ? '🧠 Advanced Reasoning' : '🚀 Simple & Fast'}
                  </span>
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    NEW
                  </span>
                  <svg 
                    className={`w-3 h-3 text-purple-400 transition-transform duration-200 ${showModelPopup ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Compact Dropdown */}
                {showModelPopup && (
                  <>
                    {/* Invisible backdrop to close on outside click */}
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setShowModelPopup(false)}
                    />
                    
                    {/* Dropdown Content */}
                    <div className="absolute top-full left-0 mt-2 w-80 bg-black/95 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-3 space-y-2">
                        {/* Simple and Fast Option */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAdvancedReasoning(false);
                            setShowModelPopup(false);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${
                            !advancedReasoning 
                              ? 'bg-green-500/20 border border-green-500/40' 
                              : 'hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="text-white text-sm font-[Orbitron] font-semibold">🚀 Simple & Fast</span>
                            <p className="text-[11px] text-white/50 mt-1">Quick responses • Unlimited use</p>
                          </div>
                          {!advancedReasoning && (
                            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        
                        {/* Advanced Reasoning Option */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (canUseAdvanced) {
                              setAdvancedReasoning(true);
                              setShowModelPopup(false);
                            } else {
                              toast.error(`⏰ Available in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`);
                            }
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                            advancedReasoning 
                              ? 'bg-purple-500/20 border border-purple-500/40' 
                              : canUseAdvanced
                              ? 'hover:bg-white/10 border border-white/10 cursor-pointer'
                              : 'opacity-50 cursor-not-allowed border border-red-500/30'
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="text-white text-sm font-[Orbitron] font-semibold">🧠 Advanced Reasoning</span>
                            <p className="text-[11px] text-white/50 mt-1">
                              {canUseAdvanced ? 'Deep thinking • 1 use / 24h' : `⏰ Wait ${hoursRemaining}h`}
                            </p>
                          </div>
                          {advancedReasoning && (
                            <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <div className="relative flex-1 flex">
                <textarea
                  className="bg-black/40 border border-white/30 placeholder:text-gray-400 text-white px-4 py-3 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-white font-[Orbitron] [&::selection]:bg-white [&::selection]:text-black resize-none w-full"
                  placeholder={t('home.placeholder')}
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
              <Magnetic className="mt-2 sm:mt-0">
                <Button
                  disabled={createProject.isPending || !value}
                  onClick={handleCreateProject}
                  className="btn-shine bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-bold font-[Orbitron] transition shadow-lg hover:shadow-fuchsia-500/40"
                >
                  {t('home.launch')}
                </Button>
              </Magnetic>
            </div>
            {value && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-left">
                <span className="text-xs sm:text-sm text-white/80 font-[Orbitron]">{t('home.needHelp')}</span>
                <Button
                  variant="outline"
                  className="text-white bg-white/10 hover:bg-white border border-white/30 hover:text-gray-900 px-4 py-2 transition font-[Orbitron]"
                  onClick={() => {
                    const qs = new URLSearchParams({ idea: value }).toString();
                    router.push(`/prompt-generator?${qs}`);
                  }}
                >
                  {t('home.enhancePrompt')}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {/* Dynamic prompts based on selected technology */}
              {selectedTech === "react-nextjs" && [
                t('prompt.landing'), t('prompt.dashboard'), t('prompt.kanban'), t('prompt.ecommerce')
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
                t('prompt.netflix'), t('prompt.portfolio'), t('prompt.tictactoe'), t('prompt.rockpaper')
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
          </motion.div>
        </div>
      </section>
      {/* Projects List Section */}
      <section className="w-full bg-black py-12">
        <div className="w-full max-w-3xl mx-auto px-4">
          <FadeIn>
            <ProjectsList />
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
export default Page;