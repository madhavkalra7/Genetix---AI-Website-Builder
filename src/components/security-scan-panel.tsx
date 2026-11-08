"use client";

import { useEffect, useMemo } from "react";
import { Loader2Icon, ShieldAlertIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  buildSecurityFixRequest,
  scanSecurity,
  type SecurityFinding,
  type SecurityScanResult,
  type SecuritySeverity,
} from "@/lib/security-scan";

const SEVERITY_STYLE: Record<SecuritySeverity, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
};

function SeverityBadge({ severity }: { severity: SecuritySeverity }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none",
        SEVERITY_STYLE[severity],
      )}
    >
      {severity}
    </span>
  );
}

function FindingRow({ finding }: { finding: SecurityFinding }) {
  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <SeverityBadge severity={finding.severity} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{finding.title}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {finding.file}
            {finding.line ? `:${finding.line}` : ""}
          </p>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">{finding.detail}</p>
          <p className="mt-0.5 break-words text-xs">
            <span className="font-medium">Fix: </span>
            {finding.fixHint}
          </p>
        </div>
      </div>
    </li>
  );
}

export interface SecurityScanPanelProps {
  /** Project files (path -> content), e.g. fragment.files */
  files: Record<string, string>;
  /** Show a "Fix with AI" button that receives a ready-made quick-edit request */
  onFixWithAi?: (request: string) => void;
  fixPending?: boolean;
  /** Receive the scan result (e.g. to block publishing while !passed) */
  onResult?: (result: SecurityScanResult) => void;
  className?: string;
}

/**
 * Self-contained security scan of a project's files: pass/fail summary + findings.
 * Pure client-side (no requests); embed it anywhere, e.g. inside the publish dialog.
 */
export function SecurityScanPanel({ files, onFixWithAi, fixPending = false, onResult, className }: SecurityScanPanelProps) {
  const result = useMemo(() => scanSecurity(files), [files]);
  const fixRequest = useMemo(() => buildSecurityFixRequest(result.findings), [result]);

  useEffect(() => {
    onResult?.(result);
  }, [onResult, result]);

  const counts = result.findings.reduce(
    (acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }),
    { high: 0, medium: 0, low: 0 } as Record<SecuritySeverity, number>,
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="status"
        className={cn(
          "flex items-center gap-3 rounded-lg border p-3",
          result.passed ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10",
        )}
      >
        {result.passed ? (
          <ShieldCheckIcon className="size-6 shrink-0 text-emerald-500" aria-hidden />
        ) : (
          <ShieldAlertIcon className="size-6 shrink-0 text-red-500" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{result.passed ? "Security scan passed" : "Security issues found"}</p>
          <p className="text-xs text-muted-foreground">
            {result.findings.length === 0
              ? "No exposed secrets or risky patterns detected."
              : `${counts.high} high · ${counts.medium} medium · ${counts.low} low`}
          </p>
        </div>
      </div>

      {onFixWithAi && result.findings.length > 0 && (
        <Button disabled={!fixRequest || fixPending} onClick={() => fixRequest && onFixWithAi(fixRequest)}>
          {fixPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          Fix with AI (1 credit)
        </Button>
      )}

      {result.findings.length > 0 && (
        <ul className="divide-y" aria-label="Security findings">
          {result.findings.map((f, i) => (
            <FindingRow key={`${f.file}:${f.line ?? 0}:${f.title}:${i}`} finding={f} />
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        Heuristic scan of the generated code. Always rotate any key that was ever published.
      </p>
    </div>
  );
}
