"use client";

// Speech-to-text mic button (browser Web Speech API — free, no tokens).
// Click to start dictating; the recognised text is passed to onTranscript as you speak.

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, MicIcon, MicOffIcon } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SpeechInputButtonProps {
  /** Called with the full text recognised in this session (final + interim). */
  onTranscript: (text: string) => void;
  /** Called once when dictation starts, e.g. to remember the text already typed. */
  onStart?: () => void;
  disabled?: boolean;
  className?: string;
  lang?: string;
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function SpeechInputButton({ onTranscript, onStart, disabled, className, lang }: SpeechInputButtonProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Stop listening when the component unmounts
  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = lang || navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTranscriptRef.current((finalText + interim).trim());
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access was blocked. Allow it in your browser to use voice input.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error("Voice input stopped: " + e.error);
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    onStart?.();
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? "Stop voice input" : "Speak your message"}
      aria-pressed={listening}
      title={listening ? "Stop voice input" : "Speak your message"}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50",
        listening ? "bg-red-500/15 text-red-400 animate-pulse" : "text-muted-foreground hover:text-foreground hover:bg-muted",
        className
      )}
    >
      {listening ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
    </button>
  );
}

interface VoiceLanguageSelectProps {
  value: string;
  onChange: (lang: string) => void;
  options: readonly { code: string; label: string; short: string }[];
  disabled?: boolean;
  className?: string;
}

/** Splits "हिन्दी · Hindi" into native + English names (labels without " · " are used as-is). */
function splitLabel(label: string): { native: string; english: string | null } {
  const [native, ...rest] = label.split(" · ");
  const english = rest.join(" · ").trim();
  return { native: native.trim(), english: english || null };
}

/**
 * Compact voice-language picker: a pill showing the short label (e.g. "EN" / "हि") that opens a
 * dark dropdown. Radix handles keyboard nav (arrows, Enter, Escape, typeahead) and flips upward
 * when there isn't room below (the trigger usually sits in the chat input at the bottom).
 */
export function VoiceLanguageSelect({ value, onChange, options, disabled, className }: VoiceLanguageSelectProps) {
  const current = options.find((o) => o.code === value) ?? options[0];
  const currentCode = current?.code ?? value;
  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger
        disabled={disabled}
        aria-label={`Voice input language: ${current?.label ?? value}`}
        title={`Voice input language: ${current?.label ?? value}`}
        className={cn(
          "inline-flex h-7 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] px-2 text-[11px] font-semibold text-muted-foreground outline-none transition-colors",
          "hover:border-purple-400/40 hover:bg-white/10 hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-purple-400/60",
          "data-[state=open]:border-purple-400/60 data-[state=open]:bg-purple-500/15 data-[state=open]:text-white",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
      >
        <span>{current?.short ?? value}</span>
        <ChevronDownIcon className="size-3 opacity-60" aria-hidden />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 min-w-[13rem] max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto rounded-xl border border-white/10 bg-[#0b0b0f]/95 p-1.5 text-white shadow-2xl shadow-black/60 backdrop-blur-xl",
            "origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          <DropdownMenuPrimitive.Label className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Voice language
          </DropdownMenuPrimitive.Label>
          <DropdownMenuPrimitive.RadioGroup value={currentCode} onValueChange={onChange}>
            {options.map((o) => {
              const { native, english } = splitLabel(o.label);
              const active = o.code === currentCode;
              return (
                <DropdownMenuPrimitive.RadioItem
                  key={o.code}
                  value={o.code}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
                    "data-[highlighted]:bg-white/[0.07]",
                    active && "bg-purple-500/15 data-[highlighted]:bg-purple-500/20"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold",
                      active ? "border-purple-400/50 bg-purple-500/20 text-purple-200" : "border-white/10 bg-white/5 text-white/60"
                    )}
                  >
                    {o.short}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className={cn("truncate font-medium", active ? "text-white" : "text-white/85")}>{native}</span>
                    {english && <span className="truncate text-[11px] text-white/45">{english}</span>}
                  </span>
                  <DropdownMenuPrimitive.ItemIndicator>
                    <CheckIcon className="size-4 text-purple-400" aria-hidden />
                  </DropdownMenuPrimitive.ItemIndicator>
                </DropdownMenuPrimitive.RadioItem>
              );
            })}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
