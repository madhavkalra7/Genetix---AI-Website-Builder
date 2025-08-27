"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function toFiveCompleteSentences(text: string) {
  if (!text) return "";
  // Remove bullets / numbering and collapse whitespace
  const cleaned = text
    .replace(/^[ \t]*([\-\u2022\*]|\d+[\.)])\s+/gim, "")
    .replace(/\s+/g, " ")
    .trim();

  // Split into sentences by punctuation boundaries
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length === 0) return "";

  // Keep only sentences that look complete (end with punctuation)
  const complete = parts.filter((p) => /[.!?]$/.test(p.trim()));
  const selected = (complete.length ? complete : parts).slice(0, 5);
  let out = selected.join(" ").trim();
  if (!/[.!?]$/.test(out) && out.length > 0) out += ".";
  return out;
}

export default function PromptGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const canGenerate = useMemo(() => idea.trim().length > 0 && !loading, [idea, loading]);

  // Prefill idea from ?idea=
  useEffect(() => {
    const i = searchParams?.get("idea");
    if (i) setIdea(i);
  }, [searchParams]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/prompt-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }
  const data = await res.json();
  const concise = toFiveCompleteSentences(String(data?.prompt || ""));
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
      <label className="text-sm text-white/80 font-[Orbitron]">Website idea</label>
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
        rows={7}
              placeholder="e.g., A portfolio site for a photographer with gallery, about, contact, and dark modern aesthetic"
              className="bg-black/40 border-white/25"
            />
          </div>

          {/* Model and API key are configured server-side */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full h-10 bg-white text-black hover:bg-gray-200 font-[Orbitron] font-semibold">Generate</Button>
            
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
            <Textarea value={result} readOnly rows={8} className="bg-black/40 border-white/25" placeholder="Your concise prompt will appear here..." />
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
