"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { AppRouter } from "@/trpc/routers/_app";

export type AdminBuild = inferRouterOutputs<AppRouter>["admin"]["builds"]["list"]["items"][number];

export function formatTokens(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m < 60 ? `${m}m ${rest}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function BuildStatusBadge({ status }: { status: string }) {
  const style =
    status === "succeeded"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "failed"
        ? "bg-red-500/15 text-red-300 border-red-500/30"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase font-[Orbitron] ${style}`}>
      {status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />}
      {status}
    </span>
  );
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const COLUMNS = 9;

export function AdminBuildsTable({ builds }: { builds: AdminBuild[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto border border-white/5 rounded-2xl bg-black/20">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-white/50 uppercase tracking-wider font-[Orbitron] text-[10px]">
            <th className="p-3 w-6" />
            <th className="p-3">Status</th>
            <th className="p-3">Project</th>
            <th className="p-3">User</th>
            <th className="p-3">Model / Effort</th>
            <th className="p-3 text-right">Tokens in / cached / out / reasoning</th>
            <th className="p-3 text-right">Duration</th>
            <th className="p-3 text-right">QA</th>
            <th className="p-3">Error</th>
          </tr>
        </thead>
        <tbody>
          {builds.length === 0 && (
            <tr>
              <td colSpan={COLUMNS} className="p-8 text-center text-white/30">
                No builds found.
              </td>
            </tr>
          )}
          {builds.map((b) => {
            const open = expanded.has(b.id);
            return (
              <Fragment key={b.id}>
                <tr
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer align-top"
                  onClick={() => toggle(b.id)}
                >
                  <td className="p-3 text-white/40">
                    {open ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                  </td>
                  <td className="p-3">
                    <BuildStatusBadge status={b.status} />
                    <div className="text-[10px] text-white/40 mt-1">{b.stage}</div>
                  </td>
                  <td className="p-3">
                    {b.isApp ? (
                      <span className="text-white/70">
                        <span className="px-1.5 py-0.5 mr-1 rounded bg-sky-500/15 text-sky-300 text-[10px] font-bold">APP</span>
                        <span className="font-mono text-[10px]">{b.projectId.slice(0, 10)}</span>
                      </span>
                    ) : (
                      <Link
                        href={`/projects/${b.projectId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-purple-300 hover:text-purple-200 underline font-mono text-[10px]"
                      >
                        {b.projectId.slice(0, 10)}
                      </Link>
                    )}
                    <div className="text-[10px] text-white/40 mt-1">{formatTime(b.startedAt)}</div>
                  </td>
                  <td className="p-3 text-white/70 max-w-[180px] truncate" title={b.userEmail ?? b.userId ?? ""}>
                    {b.userEmail ?? (b.userId ? <span className="font-mono text-[10px]">{b.userId.slice(0, 10)}</span> : "—")}
                  </td>
                  <td className="p-3 text-white/80">
                    <div>{b.model ?? "—"}</div>
                    <div className="text-[10px] text-white/40">
                      {b.reasoningEffort ?? "—"} · {b.llmCalls} call{b.llmCalls === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono text-white/80 whitespace-nowrap">
                    {formatTokens(b.inputTokens)} / {formatTokens(b.cachedTokens)} / {formatTokens(b.outputTokens)} /{" "}
                    {formatTokens(b.reasoningTokens)}
                  </td>
                  <td className="p-3 text-right text-white/80 whitespace-nowrap">{formatDuration(b.durationMs)}</td>
                  <td className={`p-3 text-right font-bold ${b.qaIssues > 0 ? "text-amber-300" : "text-white/50"}`}>
                    {b.qaIssues}
                  </td>
                  <td className="p-3 max-w-[260px]">
                    {b.error ? (
                      <span className="text-red-300 line-clamp-2 break-words" title={b.error}>
                        {b.error}
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-white/5 bg-black/30">
                    <td />
                    <td colSpan={COLUMNS - 1} className="p-4 space-y-4">
                      <div className="text-[10px] text-white/40 font-mono">
                        build {b.id} · project {b.projectId} · finished {formatTime(b.finishedAt)}
                      </div>
                      {b.error && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider text-red-300/80 font-[Orbitron] mb-1">Error</h4>
                          <pre className="whitespace-pre-wrap break-words text-red-200/90 text-[11px] bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                            {b.error}
                          </pre>
                        </div>
                      )}
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-white/50 font-[Orbitron] mb-1">Review summary</h4>
                        {b.reviewSummary ? (
                          <pre className="whitespace-pre-wrap break-words text-white/80 text-[11px] bg-white/5 border border-white/10 rounded-lg p-3 max-h-64 overflow-y-auto">
                            {b.reviewSummary}
                          </pre>
                        ) : (
                          <p className="text-white/30 text-[11px]">No review summary.</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-white/50 font-[Orbitron] mb-1">
                          Events ({b.events.length})
                        </h4>
                        {b.events.length === 0 ? (
                          <p className="text-white/30 text-[11px]">No events recorded.</p>
                        ) : (
                          <ol className="space-y-1 max-h-72 overflow-y-auto border border-white/10 rounded-lg p-3 bg-white/5">
                            {b.events.map((ev, i) => (
                              <li key={i} className="flex gap-3 text-[11px]">
                                <span className="text-white/35 font-mono shrink-0">
                                  {ev.at ? new Date(ev.at).toLocaleTimeString() : "—"}
                                </span>
                                <span className="text-purple-300 font-semibold shrink-0">{ev.stage}</span>
                                {ev.detail && <span className="text-white/70 break-words">{ev.detail}</span>}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
