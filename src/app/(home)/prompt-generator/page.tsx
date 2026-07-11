"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Component to handle useSearchParams inside Suspense
function PromptGeneratorContent({ initialIdea }: { initialIdea?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idea, setIdea] = useState(initialIdea || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [mode, setMode] = useState<"standard" | "limitless">("standard");

  const canGenerate = useMemo(() => idea.trim().length > 0 && !loading, [idea, loading]);

  // Prefill idea from ?idea=
  useEffect(() => {
    const i = searchParams?.get("idea");
    if (i && !idea) setIdea(i);
  }, [searchParams]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/prompt-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const concise = mode === "limitless" 
        ? String(data?.prompt || "") 
        : toFiveCompleteSentences(String(data?.prompt || ""));
      setResult(concise);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate prompt");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      toast.success("Prompt copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleUse = () => {
    if (!result) return;
    const qs = new URLSearchParams({ prompt: result }).toString();
    router.push(`/?${qs}`);
  };

  return (
    <main className="min-h-screen w-full bg-black text-white">
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-3xl md:text-4xl mb-2 font-[Orbitron] font-extrabold tracking-wider">Prompt Helper 🤖</h1>
        <p className="text-white/80 mb-8 font-[Orbitron]">Describe your website idea. We’ll craft a concise builder-ready prompt.</p>

        <div className="space-y-6 border border-white/15 rounded-3xl p-8 bg-gradient-to-b from-white/5 to-white/10 shadow-2xl w-full min-h-[60vh]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/80 font-[Orbitron]">Website idea</label>
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-[Orbitron] font-bold transition-all duration-300 ${
                mode === "limitless"
                  ? "bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)] animate-pulse"
                  : "bg-white/10 text-white/60"
              }`}>
                {mode === "limitless" ? "✨ LimitLess Mode (No Limits)" : "Standard Mode"}
              </span>
            </div>
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={7}
              placeholder={
                mode === "limitless"
                  ? "Describe your project in detail. In LimitLess mode, there are no length or style restrictions—you can request games, dashboards, multi-page tools, or anything else, and we'll generate a fully detailed, premium prompt for you."
                  : "e.g., A portfolio site for a photographer with gallery, about, contact, and dark modern aesthetic"
              }
              className="bg-black/40 border-white/25"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full h-10 bg-white text-black hover:bg-gray-200 font-[Orbitron] font-semibold">Generate</Button>
            <Button
              onClick={() => setMode(mode === "standard" ? "limitless" : "standard")}
              className={`w-full h-10 font-[Orbitron] font-semibold transition-all duration-300 ${
                mode === "limitless"
                  ? "bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white border-none shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:opacity-90 active:scale-95 cursor-pointer"
                  : "border border-white/40 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              }`}
            >
              🚀 LimitLess {mode === "limitless" ? "ON" : "OFF"}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setIdea(""); setResult(""); }}
              disabled={loading}
              className="w-full h-10 border-white/40 bg-white/10 text-white hover:bg-white/20 font-[Orbitron]"
            >
              Reset
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/80 font-[Orbitron]">Generated prompt</label>
            <Textarea value={result} readOnly rows={8} className="bg-black/40 border-white/25" placeholder={mode === "limitless" ? "Your limitless premium prompt will appear here..." : "Your concise prompt will appear here..."} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button onClick={handleUse} disabled={!result} className="w-full h-10 bg-white text-black hover:bg-gray-200 font-[Orbitron] font-semibold">Use in Builder</Button>
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={!result}
              className="w-full h-10 border-white/40 bg-white/10 text-white hover:bg-white/20 font-[Orbitron]"
            >
              Copy
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function toFiveCompleteSentences(text: string) {
  if (!text) return "";
  const cleaned = text
    .replace(/^[ \t]*([\-\u2022\*]|\d+[\.)])\s+/gim, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const complete = parts.filter((p) => /[.!?]$/.test(p.trim()));
  const selected = (complete.length ? complete : parts).slice(0, 5);
  let out = selected.join(" ").trim();
  if (!/[.!?]$/.test(out) && out.length > 0) out += ".";
  return out;
}

export default function PromptGeneratorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-black text-white flex items-center justify-center">Loading...</div>}>
      <PromptGeneratorContent />
    </Suspense>
  );
}