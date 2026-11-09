"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ActivityIcon, Loader2Icon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Starfield, AuroraBackground } from "@/components/animations/aurora-background";
import { AdminBuildsTable, formatDuration, formatTokens } from "@/components/admin-builds-table";

type Days = 1 | 7 | 30;
type StatusFilter = "all" | "running" | "succeeded" | "failed";

function StatCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "bad" }) {
  const valueColor = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-white";
  return (
    <div className="p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-wider text-white/45 font-[Orbitron]">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/45 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminBuildsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const trpc = useTRPC();
  const [days, setDays] = useState<Days>(7);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: isAdmin, isLoading: isLoadingAdmin } = useQuery(trpc.admin.isAdmin.queryOptions());
  const enabled = !!user && !!isAdmin;

  const stats = useQuery(trpc.admin.builds.stats.queryOptions({ days }, { enabled }));
  const daily = useQuery(trpc.admin.builds.dailyTokens.queryOptions(undefined, { enabled, refetchInterval: 60_000 }));

  const builds = useInfiniteQuery(
    trpc.admin.builds.list.infiniteQueryOptions(
      { limit: 50, status: statusFilter === "all" ? undefined : statusFilter },
      { enabled, getNextPageParam: (last) => last.nextCursor ?? undefined }
    )
  );
  const buildRows = builds.data?.pages.flatMap((p) => p.items) ?? [];

  if (loading || isLoadingAdmin) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white gap-4 font-sans select-none z-50">
        <Loader2Icon className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-xs text-white/50 uppercase tracking-widest font-[Orbitron]">Checking Credentials...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white p-6 text-center gap-4 font-sans z-50">
        <Starfield count={50} />
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-3xl font-bold animate-pulse mb-2">🔒</div>
        <h1 className="text-2xl font-bold font-[Orbitron] text-red-400">Admin Access Required</h1>
        <p className="text-xs text-white/50 max-w-sm leading-relaxed font-[Orbitron]">
          This page requires administrator permissions. If you are authorized, please log in with your administrator account.
        </p>
        <Button
          onClick={() => router.push("/auth/signin")}
          className="bg-purple-600 hover:bg-purple-700 text-white font-[Orbitron] rounded-xl px-6 cursor-pointer"
        >
          Go to Sign In
        </Button>
      </div>
    );
  }

  const s = stats.data;
  const maxPerDay = Math.max(1, ...(s?.perDay.map((d) => d.total) ?? [0]));

  return (
    <div className="relative min-h-screen w-full text-white overflow-x-hidden pt-24 pb-12 px-6 md:px-12 font-sans">
      <div className="absolute inset-0 bg-black -z-20" />
      <div className="absolute inset-0 -z-10 opacity-70">
        <Starfield count={80} />
        <AuroraBackground />
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-white/10 font-[Orbitron]">
          <div>
            <div className="flex items-center gap-2">
              <ActivityIcon className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Build Monitor
              </h1>
            </div>
            <p className="text-xs text-white/55 mt-1 font-sans">
              Every AI build: outcome, duration, token usage, QA results and the pipeline event log.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
              {([1, 7, 30] as Days[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 h-8 rounded-lg text-xs cursor-pointer transition-colors ${
                    days === d ? "bg-purple-600 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {d === 1 ? "24h" : `${d}d`}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                stats.refetch();
                builds.refetch();
                daily.refetch();
              }}
              className="h-10 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Refresh"
            >
              <RefreshCwIcon className={`w-4 h-4 ${stats.isFetching || builds.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Link
              href="/admin-create-user"
              className="h-10 px-4 rounded-xl border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-2"
            >
              <ShieldCheckIcon className="w-4 h-4" />
              Admin Console
            </Link>
          </div>
        </header>

        {/* Today's OpenAI key usage vs the daily cap (AI work pauses at the cap until 00:00 UTC) */}
        {daily.data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {daily.data.groups.map((g) => {
              const cap = Math.max(1, g.cap);
              const pct = Math.min(100, (g.used / cap) * 100);
              return (
                <StatCard
                  key={g.group}
                  label={`Today's tokens · ${g.group === "large" ? "Sol (large)" : "Terra (small)"}`}
                  value={`${formatTokens(g.used)} / ${formatTokens(cap)} (${pct.toFixed(0)}%)`}
                  sub={`${g.requests} calls · ${pct >= 100 ? "PAUSED · " : ""}resets ${daily.data.resetLabel}`}
                  tone={pct >= 100 ? "bad" : pct >= 80 ? "default" : "good"}
                />
              );
            })}
          </div>
        ) : daily.error ? (
          <p className="text-red-300 text-sm">Daily token meter unavailable: {daily.error.message}</p>
        ) : null}

        {/* Stat cards */}
        {stats.isLoading ? (
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <Loader2Icon className="w-4 h-4 animate-spin text-purple-500" /> Loading stats...
          </div>
        ) : stats.error ? (
          <p className="text-red-300 text-sm">Failed to load stats: {stats.error.message}</p>
        ) : s ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Builds"
                value={String(s.totalBuilds)}
                sub={`${s.running} running · ${s.totalLlmCalls} LLM calls`}
              />
              <StatCard
                label="Success rate"
                value={s.successRate == null ? "—" : `${(s.successRate * 100).toFixed(1)}%`}
                sub={`${s.succeeded} succeeded`}
                tone={s.successRate == null ? "default" : s.successRate >= 0.9 ? "good" : s.successRate < 0.7 ? "bad" : "default"}
              />
              <StatCard label="Failures" value={String(s.failed)} tone={s.failed > 0 ? "bad" : "default"} />
              <StatCard label="Avg duration" value={formatDuration(s.avgDurationMs)} sub="finished builds" />
              <StatCard
                label="Avg tokens / build"
                value={formatTokens(s.tokens.avg.input + s.tokens.avg.output)}
                sub={`in ${formatTokens(s.tokens.avg.input)} · cached ${formatTokens(s.tokens.avg.cached)} · out ${formatTokens(s.tokens.avg.output)} · reasoning ${formatTokens(s.tokens.avg.reasoning)}`}
              />
              <StatCard
                label="Total tokens"
                value={formatTokens(s.tokens.total.input + s.tokens.total.output)}
                sub={`in ${formatTokens(s.tokens.total.input)} · cached ${formatTokens(s.tokens.total.cached)} · out ${formatTokens(s.tokens.total.output)} · reasoning ${formatTokens(s.tokens.total.reasoning)}`}
              />
              <StatCard
                label="Cache hit rate"
                value={s.tokens.total.input > 0 ? `${((s.tokens.total.cached / s.tokens.total.input) * 100).toFixed(1)}%` : "—"}
                sub="cached / input tokens"
              />
              <StatCard
                label="Avg QA issues"
                value={s.avgQaIssues.toFixed(2)}
                sub={`avg ${s.avgLlmCalls.toFixed(1)} LLM calls / build`}
                tone={s.avgQaIssues > 2 ? "bad" : "default"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Builds per day */}
              <div className="p-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl space-y-3">
                <h2 className="text-sm font-bold font-[Orbitron] text-white">Builds per day</h2>
                <div className="flex items-center gap-4 text-[10px] text-white/50">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400/80" />succeeded</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400/80" />failed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-300/70" />running</span>
                </div>
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {s.perDay
                    .slice()
                    .reverse()
                    .map((d) => {
                      const other = Math.max(0, d.total - d.succeeded - d.failed);
                      const pct = (n: number) => `${(n / maxPerDay) * 100}%`;
                      return (
                        <li key={d.date} className="flex items-center gap-3 text-[11px]">
                          <span className="w-20 shrink-0 text-white/50 font-mono">{d.date.slice(5)}</span>
                          <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden flex" title={`${d.succeeded} ok · ${d.failed} failed · ${other} running`}>
                            <div className="h-full bg-emerald-400/80" style={{ width: pct(d.succeeded) }} />
                            <div className="h-full bg-red-400/80" style={{ width: pct(d.failed) }} />
                            <div className="h-full bg-amber-300/70" style={{ width: pct(other) }} />
                          </div>
                          <span className="w-8 text-right text-white/80 font-mono">{d.total}</span>
                        </li>
                      );
                    })}
                </ul>
              </div>

              {/* Top users */}
              <div className="p-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl space-y-3">
                <h2 className="text-sm font-bold font-[Orbitron] text-white">Top users by tokens</h2>
                {s.topUsers.length === 0 ? (
                  <p className="text-xs text-white/30">No builds in this period.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/45 text-[10px] uppercase tracking-wider font-[Orbitron]">
                        <th className="text-left py-1.5">User</th>
                        <th className="text-right py-1.5">Builds</th>
                        <th className="text-right py-1.5">Input</th>
                        <th className="text-right py-1.5">Output</th>
                        <th className="text-right py-1.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.topUsers.map((u) => (
                        <tr key={u.userId} className="border-t border-white/5">
                          <td className="py-1.5 text-white/80 max-w-[200px] truncate" title={u.email ?? u.userId}>
                            {u.email ?? <span className="font-mono text-[10px]">{u.userId.slice(0, 12)}</span>}
                          </td>
                          <td className="py-1.5 text-right text-white/70">{u.builds}</td>
                          <td className="py-1.5 text-right font-mono text-white/70">{formatTokens(u.inputTokens)}</td>
                          <td className="py-1.5 text-right font-mono text-white/70">{formatTokens(u.outputTokens)}</td>
                          <td className="py-1.5 text-right font-mono text-purple-300 font-bold">{formatTokens(u.totalTokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Recent builds */}
        <div className="p-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-bold font-[Orbitron] text-white">Recent builds</h2>
            <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
              {(["all", "running", "succeeded", "failed"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 h-8 rounded-lg text-xs capitalize cursor-pointer transition-colors ${
                    statusFilter === f ? "bg-purple-600 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {builds.isLoading ? (
            <div className="p-8 text-center text-white/40 text-xs">
              <Loader2Icon className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
              Loading builds...
            </div>
          ) : builds.error ? (
            <p className="text-red-300 text-sm">Failed to load builds: {builds.error.message}</p>
          ) : (
            <AdminBuildsTable builds={buildRows} />
          )}

          {builds.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                disabled={builds.isFetchingNextPage}
                onClick={() => builds.fetchNextPage()}
                className="rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                {builds.isFetchingNextPage ? <Loader2Icon className="w-4 h-4 animate-spin" /> : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
