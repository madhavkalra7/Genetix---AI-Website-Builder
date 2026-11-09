"use client";

import { useId, useState } from "react";
import { CheckIcon, GlobeIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_PRESETS } from "@/lib/theme-presets";
import type { StyleDna } from "@/lib/style-dna";
import { StyleDnaDialog } from "@/components/style-dna-dialog";

interface ThemePickerProps {
  /** Selected preset id, or null for "let AI decide". */
  value: string | null;
  onChange: (themeId: string | null) => void;
  /** Custom theme extracted from a website ("Style DNA"). When set it is the selected theme. */
  styleDna?: StyleDna | null;
  /** Enables the "From a website…" chip. Omit to keep the picker preset-only. */
  onStyleDnaChange?: (styleDna: StyleDna | null) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

type PickerOption = {
  key: string;
  id: string | null;
  name: string;
  description: string;
  dots: string[] | null;
  isStyleDna?: boolean;
};

const chipClass = (selected: boolean) =>
  cn(
    "snap-start shrink-0 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50",
    selected
      ? "border-purple-400 bg-purple-500/20 text-white"
      : "border-white/20 bg-black/30 text-white/75 hover:bg-white/10 hover:text-white",
  );

function Dots({ colors }: { colors: string[] }) {
  return (
    <span className="flex -space-x-1" aria-hidden="true">
      {colors.map((color, j) => (
        <span key={j} className="size-3 rounded-full border border-white/40" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

/** Compact, horizontally scrollable row of theme swatch chips (single-select radio group). */
export function ThemePicker({
  value,
  onChange,
  styleDna = null,
  onStyleDnaChange,
  disabled,
  className,
  label = "Design theme",
}: ThemePickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canUseStyleDna = !!onStyleDnaChange;
  const activeDna = canUseStyleDna ? styleDna : null;

  const presetOptions: PickerOption[] = THEME_PRESETS.map((t) => ({
    key: t.id,
    id: t.id,
    name: t.name,
    description: t.description,
    dots: [t.palette.bg, t.palette.primary, t.palette.accent, t.palette.text],
  }));
  const options: PickerOption[] = [
    { key: "none", id: null, name: "No theme (let AI decide)", description: "Genetix picks the design", dots: null },
    ...(activeDna
      ? [
          {
            key: "style-dna",
            id: null,
            name: activeDna.name,
            description: `${activeDna.description} (from ${activeDna.sourceHost})`,
            dots: [activeDna.palette.bg, activeDna.palette.primary, activeDna.palette.accent, activeDna.palette.text],
            isStyleDna: true,
          },
        ]
      : []),
    ...presetOptions,
  ];
  const labelId = useId();
  const selectedIndex = activeDna
    ? options.findIndex((o) => o.isStyleDna)
    : Math.max(0, options.findIndex((o) => !o.isStyleDna && o.id === value));

  const select = (opt: PickerOption) => {
    if (opt.isStyleDna) return; // already selected while present
    if (activeDna) onStyleDnaChange?.(null);
    onChange(opt.id);
  };

  const focusOption = (container: HTMLElement | null, index: number) => {
    const buttons = container?.querySelectorAll<HTMLButtonElement>("button[role=radio]");
    buttons?.[index]?.focus();
  };

  const renderOption = (opt: PickerOption, i: number) => {
    const selected = i === selectedIndex;
    const radio = (
      <button
        key={opt.key}
        type="button"
        role="radio"
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        title={opt.description}
        disabled={disabled}
        onClick={() => select(opt)}
        className={opt.isStyleDna ? "flex items-center gap-2 focus-visible:outline-none focus-visible:underline" : chipClass(selected)}
      >
        {opt.dots && <Dots colors={opt.dots} />}
        <span>{opt.name}</span>
        {selected && <CheckIcon className="size-3.5 text-purple-300" aria-hidden="true" />}
      </button>
    );
    if (!opt.isStyleDna) return radio;
    return (
      <span key={opt.key} className={cn(chipClass(selected), "pr-1.5")}>
        {radio}
        <button
          type="button"
          aria-label={`Remove ${opt.name} theme`}
          title="Remove this style"
          disabled={disabled}
          onClick={() => onStyleDnaChange?.(null)}
          className="rounded-full p-0.5 text-white/70 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <XIcon className="size-3" aria-hidden="true" />
        </button>
      </span>
    );
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
          if ((e.target as HTMLElement).getAttribute("role") !== "radio") return;
          e.preventDefault();
          let next = selectedIndex;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (selectedIndex + 1) % options.length;
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (selectedIndex - 1 + options.length) % options.length;
          if (e.key === "Home") next = 0;
          if (e.key === "End") next = options.length - 1;
          select(options[next]);
          focusOption(e.currentTarget, next);
        }}
      >
        {renderOption(options[0], 0)}
        {canUseStyleDna && (
          <button
            type="button"
            title="Borrow the colours, fonts and feel of any website"
            disabled={disabled}
            onClick={() => setDialogOpen(true)}
            className={chipClass(false)}
          >
            <GlobeIcon className="size-3.5" aria-hidden="true" />
            <span>From a website…</span>
          </button>
        )}
        {options.slice(1).map((opt, i) => renderOption(opt, i + 1))}
      </div>
      {canUseStyleDna && (
        <StyleDnaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onUse={(dna) => {
            onStyleDnaChange?.(dna);
            onChange(null);
          }}
        />
      )}
    </div>
  );
}
