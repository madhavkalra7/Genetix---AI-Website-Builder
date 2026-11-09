"use client";

import { useMemo, useState } from "react";
import {
    ArrowUpRightIcon,
    CakeIcon,
    CalendarCheckIcon,
    CameraIcon,
    ChartLineIcon,
    ChefHatIcon,
    CroissantIcon,
    CrosshairIcon,
    Gamepad2Icon,
    KeyboardIcon,
    LayoutTemplateIcon,
    MailOpenIcon,
    PanelsTopLeftIcon,
    TimerIcon,
    type LucideIcon,
} from "lucide-react";
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

// One consistent line-icon style for every card (no per-card colours/emojis)
const ICONS: Record<string, LucideIcon> = {
    "neon-snake": Gamepad2Icon,
    "space-shooter": CrosshairIcon,
    "typing-test": KeyboardIcon,
    pomodoro: TimerIcon,
    "recipe-finder": ChefHatIcon,
    "habit-tracker": CalendarCheckIcon,
    "crypto-dashboard": ChartLineIcon,
    bakery: CroissantIcon,
    "photographer-portfolio": CameraIcon,
    "saas-landing": PanelsTopLeftIcon,
    "wedding-invite": MailOpenIcon,
    "birthday-surprise": CakeIcon,
};

export function StarterGallery({ onSelect, className, activeId }: StarterGalleryProps) {
    const [filter, setFilter] = useState<Filter>("All");

    const starters = useMemo(
        () => (filter === "All" ? STARTER_PROMPTS : STARTER_PROMPTS.filter((s) => s.category === filter)),
        [filter]
    );

    return (
        <section className={cn("w-full text-left", className)} aria-labelledby="starter-gallery-heading">
            <div className="mb-4 flex flex-col gap-3">
                <div>
                    <h2
                        id="starter-gallery-heading"
                        className="font-[Orbitron] text-base font-bold tracking-wider text-white sm:text-lg"
                    >
                        Start from an idea
                    </h2>
                    <p className="mt-1 text-xs text-white/50 sm:text-sm">
                        Pick a starter — we&apos;ll fill in a detailed prompt you can tweak.
                    </p>
                </div>
                <div className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter starters by category">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            aria-pressed={filter === f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70",
                                filter === f
                                    ? "border-purple-400/50 bg-purple-500/15 text-white"
                                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {starters.map((starter) => {
                    const Icon = ICONS[starter.id] ?? LayoutTemplateIcon;
                    const active = activeId === starter.id;
                    return (
                        <li key={starter.id} className="min-w-0">
                            <button
                                type="button"
                                onClick={() => onSelect(starter.prompt, starter)}
                                aria-label={`Use starter: ${starter.title}. ${starter.description}`}
                                aria-pressed={active}
                                className={cn(
                                    "group relative flex h-full w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-left backdrop-blur-sm transition-all duration-300",
                                    "outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70",
                                    active
                                        ? "border-purple-400/60 bg-purple-500/[0.08] shadow-[0_0_24px_-8px_rgba(168,85,247,0.6)]"
                                        : "border-white/10 bg-white/[0.03] hover:border-purple-400/40 hover:bg-white/[0.05] hover:shadow-[0_0_24px_-10px_rgba(168,85,247,0.55)]"
                                )}
                            >
                                {/* Icon tile: same style for every card */}
                                <span
                                    className={cn(
                                        "flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300",
                                        active
                                            ? "border-purple-400/50 bg-purple-500/20 text-purple-200"
                                            : "border-white/10 bg-white/[0.04] text-white/70 group-hover:border-purple-400/40 group-hover:bg-purple-500/10 group-hover:text-purple-200"
                                    )}
                                    aria-hidden
                                >
                                    <Icon className="size-[18px]" strokeWidth={1.75} />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">{starter.title}</span>
                                    <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/50">{starter.description}</span>
                                </span>

                                <ArrowUpRightIcon
                                    className="size-4 shrink-0 text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-purple-300 motion-reduce:transform-none"
                                    aria-hidden
                                />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
