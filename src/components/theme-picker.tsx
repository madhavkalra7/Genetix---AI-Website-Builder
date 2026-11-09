"use client";

import { useId } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_PRESETS } from "@/lib/theme-presets";

interface ThemePickerProps {
  /** Selected preset id, or null for "let AI decide". */
  value: string | null;
  onChange: (themeId: string | null) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

/** Compact, horizontally scrollable row of theme swatch chips (single-select radio group). */
export function ThemePicker({ value, onChange, disabled, className, label = "Design theme" }: ThemePickerProps) {
  const options = [
    { id: null as string | null, name: "No theme (let AI decide)", description: "Genetix picks the design", dots: null as string[] | null },
    ...THEME_PRESETS.map((t) => ({
      id: t.id as string | null,
      name: t.name,
      description: t.description,
      dots: [t.palette.bg, t.palette.primary, t.palette.accent, t.palette.text],
    })),
  ];
  const labelId = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === value));

  const focusOption = (container: HTMLElement | null, index: number) => {
    const buttons = container?.querySelectorAll<HTMLButtonElement>("button[role=radio]");
    buttons?.[index]?.focus();
  };

  return (
    <div className={cn("w-full text-left", className)}>
      <p id={labelId} className="mb-2 text-xs text-white/70 font-[Orbitron]">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] snap-x"
        onKeyDown={(e) => {
          if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          let next = selectedIndex;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (selectedIndex + 1) % options.length;
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (selectedIndex - 1 + options.length) % options.length;
          if (e.key === "Home") next = 0;
          if (e.key === "End") next = options.length - 1;
          onChange(options[next].id);
          focusOption(e.currentTarget, next);
        }}
      >
        {options.map((opt, i) => {
          const selected = i === selectedIndex;
          return (
            <button
              key={opt.id ?? "none"}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              title={opt.description}
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                "snap-start shrink-0 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50",
                selected
                  ? "border-purple-400 bg-purple-500/20 text-white"
                  : "border-white/20 bg-black/30 text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              {opt.dots && (
                <span className="flex -space-x-1" aria-hidden="true">
                  {opt.dots.map((color, j) => (
                    <span
                      key={j}
                      className="size-3 rounded-full border border-white/40"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              )}
              <span>{opt.name}</span>
              {selected && <CheckIcon className="size-3.5 text-purple-300" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
