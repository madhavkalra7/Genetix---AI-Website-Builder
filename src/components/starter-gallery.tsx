"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { STARTER_CATEGORIES, STARTER_PROMPTS, type StarterCategory, type StarterPrompt } from "@/lib/starter-prompts";

interface StarterGalleryProps {
    onSelect: (prompt: string, starter: StarterPrompt) => void;
    className?: string;
    /** Highlights the card whose prompt is currently in the prompt box */
    activeId?: string | null;
}

type Filter = "All" | StarterCategory;
const FILTERS: Filter[] = ["All", ...STARTER_CATEGORIES];

export function StarterGallery({ onSelect, className, activeId }: StarterGalleryProps) {
    const [filter, setFilter] = useState<Filter>("All");

    const starters = useMemo(
        () => (filter === "All" ? STARTER_PROMPTS : STARTER_PROMPTS.filter((s) => s.category === filter)),
        [filter]
    );

    return (
        <section className={cn("w-full text-left", className)} aria-labelledby="starter-gallery-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
                <div>
                    <h2
                        id="starter-gallery-heading"
                        className="font-[Orbitron] text-white text-base sm:text-lg font-bold tracking-wider"
                    >
                        Start from an idea
                    </h2>
                    <p className="text-xs sm:text-sm text-white/55 mt-1">
                        Pick a starter — we&apos;ll fill in a detailed prompt you can tweak.
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter starters by category">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            aria-pressed={filter === f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "rounded-full border px-3 py-1 text-xs font-[Orbitron] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                                filter === f
                                    ? "bg-white text-gray-900 border-white"
                                    : "bg-white/5 text-white/75 border-white/20 hover:bg-white/15 hover:text-white"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {starters.map((starter) => {
                    const [from, to] = starter.gradient;
                    const active = activeId === starter.id;
                    return (
                        <li key={starter.id} className="min-w-0">
                            <button
                                type="button"
                                onClick={() => onSelect(starter.prompt, starter)}
                                aria-label={`Use starter: ${starter.title}. ${starter.description}`}
                                aria-pressed={active}
                                className={cn(
                                    "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-black/40 text-left transition-all duration-300",
                                    "hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-900/30 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                                    active ? "border-white/80 ring-1 ring-white/60" : "border-white/15 hover:border-white/40"
                                )}
                            >
                                {/* Gradient art with the emoji */}
                                <div
                                    className="relative flex h-20 sm:h-28 items-center justify-center overflow-hidden"
                                    style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                                >
                                    <div
                                        className="absolute inset-0 opacity-30 mix-blend-overlay"
                                        style={{
                                            backgroundImage:
                                                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9), transparent 40%), radial-gradient(circle at 80% 90%, rgba(0,0,0,0.6), transparent 45%)",
                                        }}
                                        aria-hidden
                                    />
                                    <span
                                        className="relative text-4xl sm:text-5xl drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transform-none"
                                        aria-hidden
                                    >
                                        {starter.emoji}
                                    </span>
                                    {/* Shine sweep on hover / focus */}
                                    <span
                                        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent -translate-x-full transition-transform duration-700 ease-out group-hover:translate-x-[400%] group-focus-visible:translate-x-[400%] motion-reduce:hidden"
                                        aria-hidden
                                    />
                                    <span className="absolute left-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                                        {starter.category}
                                    </span>
                                </div>
                                <div className="flex flex-1 flex-col gap-1 p-3">
                                    <h3 className="font-[Orbitron] text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                                        {starter.title}
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-white/60 leading-snug line-clamp-2">
                                        {starter.description}
                                    </p>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
