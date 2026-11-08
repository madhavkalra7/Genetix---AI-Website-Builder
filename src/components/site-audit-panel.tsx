"use client";

import { useMemo } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, SparklesIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  auditSite,
  buildAuditFixRequest,
  type AuditCheck,
  type AuditStatus,
} from "@/lib/site-audit";

const scoreTone = (score: number) =>
  score >= 90 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500";

export function ScoreRing({ score, size = 112, label }: { score: number; size?: number; label?: string }) {
  const stroke = Math.max(6, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", scoreTone(clamped))}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Score"}: ${clamped} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute font-semibold tabular-nums" style={{ fontSize: size / 3.6 }} aria-hidden>
        {clamped}
      </span>
    </div>
  );
}

const STATUS_META: Record<AuditStatus, { Icon: typeof CheckCircle2Icon; className: string; label: string }> = {
  pass: { Icon: CheckCircle2Icon, className: "text-emerald-500", label: "Passed" },
  warn: { Icon: AlertTriangleIcon, className: "text-amber-500", label: "Warning" },
  fail: { Icon: XCircleIcon, className: "text-red-500", label: "Failed" },
};

const STATUS_ORDER: Record<AuditStatus, number> = { fail: 0, warn: 1, pass: 2 };

function CheckRow({ check }: { check: AuditCheck }) {
  const { Icon, className, label } = STATUS_META[check.status];
  return (
    <li className="flex gap-2 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-label={label} role="img" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{check.title}</p>
        <p className="break-words text-xs text-muted-foreground">{check.detail}</p>
        {check.status !== "pass" && check.fixHint && (
          <p className="mt-0.5 break-words text-xs">
            <span className="font-medium">Fix: </span>
            {check.fixHint}
          </p>
        )}
      </div>
    </li>
  );
}

interface SiteAuditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: Record<string, string>;
  /** Send one quick AI edit with the given request; omit to hide the button */
  onFixWithAi?: (request: string) => void;
  fixPending?: boolean;
}

/** SEO + accessibility audit of a static project, in a side sheet. */
export function SiteAuditPanel({ open, onOpenChange, files, onFixWithAi, fixPending = false }: SiteAuditPanelProps) {
  // Only compute while open (big projects + data URLs)
  const result = useMemo(() => (open ? auditSite(files) : null), [open, files]);
  const fixRequest = useMemo(() => (result ? buildAuditFixRequest(result.checks) : ""), [result]);
  const issues = result ? result.checks.filter((c) => c.status !== "pass").length : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>SEO & accessibility audit</SheetTitle>
          <SheetDescription>Checks the current version&apos;s HTML. Fixes are applied with one quick AI edit.</SheetDescription>
        </SheetHeader>

        {result && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex items-center gap-4 py-4">
              <ScoreRing score={result.score} label="Overall score" />
              <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
                {AUDIT_CATEGORIES.map((cat) => (
                  <div key={cat} className="min-w-0">
                    <p className="truncate text-[11px] text-muted-foreground">{AUDIT_CATEGORY_LABELS[cat]}</p>
                    <p className={cn("text-lg font-semibold tabular-nums", scoreTone(result.categoryScores[cat]))}>
                      {result.categoryScores[cat]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {onFixWithAi && (
              <Button
                className="mb-2 w-full"
                disabled={!fixRequest || fixPending}
                onClick={() => fixRequest && onFixWithAi(fixRequest)}
              >
                {fixPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                {issues ? `Fix all with AI (${issues} issue${issues === 1 ? "" : "s"} · 1 credit)` : "Nothing to fix"}
              </Button>
            )}

            {AUDIT_CATEGORIES.map((cat) => {
              const checks = result.checks
                .filter((c) => c.category === cat)
                .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
              if (!checks.length) return null;
              return (
                <section key={cat} className="mt-3" aria-label={AUDIT_CATEGORY_LABELS[cat]}>
                  <h3 className="flex items-center justify-between border-b pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {AUDIT_CATEGORY_LABELS[cat]}
                    <span className={cn("tabular-nums", scoreTone(result.categoryScores[cat]))}>
                      {result.categoryScores[cat]}
                    </span>
                  </h3>
                  <ul className="divide-y">
                    {checks.map((check) => (
                      <CheckRow key={check.id} check={check} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
