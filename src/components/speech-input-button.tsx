"use client";

// Speech-to-text mic button (browser Web Speech API — free, no tokens).
// Click to start dictating; the recognised text is passed to onTranscript as you speak.

import { useEffect, useRef, useState } from "react";
import { MicIcon, MicOffIcon } from "lucide-react";
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

/** Compact voice-language picker: shows a short label (e.g. "EN" / "हि") over a native select. */
export function VoiceLanguageSelect({ value, onChange, options, disabled, className }: VoiceLanguageSelectProps) {
  const current = options.find((o) => o.code === value) ?? options[0];
  return (
    <span
      title={`Voice input language: ${current?.label ?? value}`}
      className={cn(
        "relative inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:ring-2 focus-within:ring-ring/50",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <span aria-hidden>{current?.short ?? value}</span>
      <select
        aria-label="Voice input language"
        value={current?.code ?? value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
