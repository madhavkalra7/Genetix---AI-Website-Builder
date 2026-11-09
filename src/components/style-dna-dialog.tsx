"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GlobeIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { googleFontsPreviewUrl, normalizeUserUrl, type StyleDna } from "@/lib/style-dna";

const FONT_LINK_ID = "style-dna-font-preview";

const RADIUS_LABEL: Record<StyleDna["radius"], string> = {
  sharp: "Sharp corners",
  soft: "Softly rounded",
  rounded: "Rounded",
  pill: "Pill-shaped",
};

/** Black or white, whichever reads better on the given #RRGGBB background. */
function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#000000" : "#FFFFFF";
}

const RADIUS_PX: Record<StyleDna["radius"], string> = { sharp: "2px", soft: "8px", rounded: "16px", pill: "9999px" };

/** Loads the preview fonts from Google Fonts (one shared <link>, replaced on change). */
function useGoogleFontsPreview(families: string[]) {
  const href = googleFontsPreviewUrl(families);
  useEffect(() => {
    if (!href) return;
    let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);
}

function friendlyError(err: { message?: string; data?: { code?: string } | null }): string {
  const code = err.data?.code;
  if (code === "UNAUTHORIZED") return "Sign in to extract a style from a website.";
  if (code === "TOO_MANY_REQUESTS" && err.message) return err.message;
  const msg = err.message ?? "";
  if (/blocked/i.test(msg)) return "That site blocked us — try another URL";
  if (code === "BAD_REQUEST" || code === "PRECONDITION_FAILED") return msg || "Couldn't read that site's styles";
  return "Couldn't read that site's styles";
}

interface StyleDnaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (styleDna: StyleDna) => void;
}

/** "From a website…" — paste a URL, preview the extracted palette/fonts/mood, then use it as the theme. */
export function StyleDnaDialog({ open, onOpenChange, onUse }: StyleDnaDialogProps) {
  const trpc = useTRPC();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<StyleDna | null>(null);

  const extract = useMutation(
    trpc.styleDna.extract.mutationOptions({
      onSuccess: (data) => setResult(data.styleDna),
      onError: (err) => toast.error(friendlyError(err)),
    }),
  );

  useGoogleFontsPreview(result ? [result.fonts.display, result.fonts.body] : []);

  const submit = () => {
    if (extract.isPending) return;
    const normalized = normalizeUserUrl(url);
    if (!normalized) {
      toast.error("Enter a website address like stripe.com");
      return;
    }
    setResult(null);
    extract.mutate({ url: normalized });
  };

  const reset = () => {
    setResult(null);
    extract.reset();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && extract.isPending) return; // keep open while reading the site
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4" aria-hidden="true" />
            Style from a website
          </DialogTitle>
          <DialogDescription>
            Paste any site and Genetix borrows its colours, fonts and feel — never its text, images or logos.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              inputMode="url"
              placeholder="stripe.com"
              aria-label="Website URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={extract.isPending}
              maxLength={2048}
            />
            <Button type="submit" className="w-full" disabled={extract.isPending || !url.trim()}>
              {extract.isPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  Reading the site&apos;s colours and fonts…
                </>
              ) : (
                "Extract style"
              )}
            </Button>
          </form>
        ) : (
          <StyleDnaPreview dna={result} />
        )}

        {result && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                setUrl("");
              }}
            >
              Try another URL
            </Button>
            <Button
              onClick={() => {
                onUse(result);
                onOpenChange(false);
                reset();
                setUrl("");
                toast.success(`Using "${result.name}" as your design theme`);
              }}
            >
              Use this style
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StyleDnaPreview({ dna }: { dna: StyleDna }) {
  const swatches: Array<[string, string]> = [
    ["Background", dna.palette.bg],
    ["Surface", dna.palette.surface],
    ["Text", dna.palette.text],
    ["Muted", dna.palette.muted],
    ["Primary", dna.palette.primary],
    ["Accent", dna.palette.accent],
  ];
  const radius = RADIUS_PX[dna.radius];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold">{dna.name}</p>
        <p className="text-sm text-muted-foreground">{dna.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">Inspired by {dna.sourceHost}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {swatches.map(([label, color]) => (
          <div key={label} className="text-center">
            <div className="h-10 w-full rounded-md border border-black/10 dark:border-white/20" style={{ backgroundColor: color }} />
            <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
            <p className="font-mono text-[10px]">{color}</p>
          </div>
        ))}
      </div>

      {/* Sample card rendered with the extracted theme */}
      <div
        className="border p-4"
        style={{ backgroundColor: dna.palette.bg, color: dna.palette.text, borderColor: dna.palette.muted + "40", borderRadius: dna.radius === "pill" ? "20px" : radius }}
      >
        <div className="p-4" style={{ backgroundColor: dna.palette.surface, borderRadius: dna.radius === "pill" ? "16px" : radius }}>
          <p className="text-xl font-bold leading-tight" style={{ fontFamily: `"${dna.fonts.display}", sans-serif` }}>
            The quick brown fox
          </p>
          <p className="mt-1 text-sm" style={{ fontFamily: `"${dna.fonts.body}", sans-serif`, color: dna.palette.muted }}>
            Body text set in {dna.fonts.body}. Headings in {dna.fonts.display}.
          </p>
          <div className="mt-3 flex gap-2">
            <span
              className="px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: dna.palette.primary, color: readableOn(dna.palette.primary), borderRadius: radius, fontFamily: `"${dna.fonts.body}", sans-serif` }}
            >
              Primary
            </span>
            <span
              className="border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: dna.palette.accent, color: dna.palette.accent, borderRadius: radius, fontFamily: `"${dna.fonts.body}", sans-serif` }}
            >
              Accent
            </span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Fonts</dt>
        <dd>
          {dna.fonts.display} / {dna.fonts.body}
        </dd>
        <dt className="text-muted-foreground">Corners</dt>
        <dd>{RADIUS_LABEL[dna.radius]}</dd>
        <dt className="text-muted-foreground">Mood</dt>
        <dd>{dna.mood}</dd>
      </dl>

      {dna.tips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {dna.tips.map((tip) => (
            <li key={tip} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
