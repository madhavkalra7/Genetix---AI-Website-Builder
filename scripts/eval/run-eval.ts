// Genetix prompt-quality eval suite.
//
// Builds every prompt in scripts/eval/prompts.json with the SAME prompts, QA validator,
// editFile semantics, reviewer and real-browser test as production (src/inngest/functions.ts),
// inside real E2B sandboxes, then scores each result and writes a markdown + JSON report.
//
// Usage:
//   npm run eval                          # all prompts
//   npm run eval -- --only snake,2048-app # subset
//   npm run eval -- --concurrency 2 --limit 5
// Env: OPENAI_API_KEY, E2B_API_KEY, E2B_TEMPLATE_ID (optional), YOU_API_KEY (optional),
//      BROWSER_QA_RUNTIME_INSTALL=true if the sandbox template has no browser yet.
//
// NOTE: the agent wiring below mirrors functions.ts in simplified form (no DB, no Inngest).
// Keep the two in sync when changing the pipeline.

import http from "http";
import fs from "fs";
import path from "path";
import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, createTool, createNetwork, openai, createState, type Message, type AgentResult } from "@inngest/agent-kit";
import { z } from "zod";
import { getTechSpecificPrompt, MOBILE_APP_PROMPT, CODE_REVIEWER_PROMPT, EDIT_TOOL_RULES } from "../../src/prompt";
import { searchWeb, isWebSearchEnabled, WEB_SEARCH_INSTRUCTIONS } from "../../src/lib/web-search";
import { validateStaticProject, formatValidationFeedback } from "../../src/lib/static-validator";
import { chatToResponsesRequest, responsesToChatResponse } from "../../src/lib/responses-bridge";
import { runBrowserQa, formatBrowserFindings, type BrowserQaResult } from "../../src/lib/browser-qa";

type Case = { id: string; mode: "web" | "app"; prompt: string };
interface S { summary: string; files: Record<string, string> }

const args = process.argv.slice(2);
const argVal = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const ONLY = argVal("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(argVal("limit")) || Infinity;
const CONCURRENCY = Math.max(1, Number(argVal("concurrency")) || 3);
const MODEL = argVal("model") || "gpt-6.1-terra";
const OUT_DIR = path.join(process.cwd(), "eval-results", new Date().toISOString().replace(/[:.]/g, "-"));

// ---------- tiny local Chat Completions -> Responses bridge (same translation as production) ----------
const usage = new Map<string, { input: number; cached: number; output: number; reasoning: number; calls: number }>();
function startBridge(): Promise<{ url: (caseId: string) => string; close: () => void }> {
  const server = http.createServer(async (req, res) => {
    const caseId = decodeURIComponent((req.url || "").split("/")[2] || "unknown");
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      try {
        const body = chatToResponsesRequest(JSON.parse(raw));
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        if (!r.ok || data.error) { res.writeHead(r.ok ? 502 : r.status, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: data.error })); }
        const u = usage.get(caseId) || { input: 0, cached: 0, output: 0, reasoning: 0, calls: 0 };
        u.input += data.usage?.input_tokens ?? 0; u.cached += data.usage?.input_tokens_details?.cached_tokens ?? 0;
        u.output += data.usage?.output_tokens ?? 0; u.reasoning += data.usage?.output_tokens_details?.reasoning_tokens ?? 0; u.calls++;
        usage.set(caseId, u);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(responsesToChatResponse(data)));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: String(e) } }));
      }
    });
  });
  // Long idle gaps (browser tests, slow reasoning) must not kill reused keep-alive sockets
  server.keepAliveTimeout = 10 * 60_000;
  server.headersTimeout = 11 * 60_000;
  server.requestTimeout = 0;
  return new Promise((resolve) => server.listen(0, () => {
    const port = (server.address() as { port: number }).port;
    resolve({ url: (caseId) => `http://127.0.0.1:${port}/c/${encodeURIComponent(caseId)}/`, close: () => server.close() });
  }));
}

// ---------- one build ----------
async function buildCase(c: Case, bridgeUrl: string) {
  const isApp = c.mode === "app";
  const t0 = Date.now();
  const sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID || "htrjn0k08ekwyjfwkcpo");
  await sandbox.setTimeout(30 * 60_000);
  const steps: string[] = [];
  const qaIssues: string[][] = [];
  let qaRounds = 0, reviewQaRounds = 0, reviewDone = false, browserFixRounds = 0;
  let reviewSummary = "";
  let initialBrowser: BrowserQaResult | null = null;
  type F = { afterResults: number; text: string };
  const codeFb: F[] = [], revFb: F[] = [];
  const fmt = (r: AgentResult): Message[] => [...r.output, ...r.toolCalls];
  const inject = (h0: Message[], results: AgentResult[], fb: F[]) => { const h = [...h0]; for (const f of [...fb].sort((a, b) => b.afterResults - a.afterResults)) { const suf = results.slice(f.afterResults).flatMap(fmt).length; h.splice(Math.max(0, h.length - suf), 0, { type: "text", role: "user", content: f.text }); } return h; };
  const qa = (files: Record<string, string>) => validateStaticProject(files, { singleFileApp: isApp, userRequest: c.prompt });
  const lastText = (r: AgentResult) => { const m = [...r.output].reverse().find((x) => x.type === "text" && x.role === "assistant") as { content?: unknown } | undefined; return typeof m?.content === "string" ? m.content : ""; };
  const model = (effort: string) => openai({ model: MODEL, baseUrl: bridgeUrl, defaultParameters: { reasoning_effort: effort } as Record<string, unknown> });
  const isGame = /\b(game|play|player|level|score|arcade|shooter|puzzle|racing|platformer)\b/i.test(c.prompt);
  const browser = (withDesign: boolean) => runBrowserQa(sandbox, { mode: "static", primary: isApp ? "mobile" : "desktop", userRequest: c.prompt, isGame, buildId: null, withDesignReview: withDesign });

  const key = (files: Record<string, string>, p: string) => { const clean = p.replace(/^\.?\/+/, "").replace(/^home\/user\//, ""); for (const k of [p, clean, `/home/user/${clean}`]) if (typeof files[k] === "string") return k; return null; };
  const write = createTool({ name: "createOrUpdateFiles", description: "Create new files or completely rewrite files (full contents). For small changes to an existing file prefer editFile.",
    parameters: z.object({ files: z.array(z.object({ path: z.string(), content: z.string() })) }),
    handler: async ({ files }, { network }) => { steps.push("write"); for (const f of files) { await sandbox.files.write(f.path, f.content); network.state.data.files[f.path] = f.content; } return `Wrote ${files.length} file(s)`; } });
  const edit = createTool({ name: "editFile", description: "Edit an EXISTING file with exact search-and-replace. Each find must match exactly once.",
    parameters: z.object({ path: z.string(), edits: z.array(z.object({ find: z.string(), replace: z.string() })).min(1) }),
    handler: async ({ path: p, edits }, { network }) => {
      steps.push("edit");
      const files = network.state.data.files; const k = key(files, p); let content = k ? files[k] : null;
      if (content == null) return `File not found: ${p}`;
      const problems: string[] = [];
      edits.forEach((e, i) => { const n = content!.split(e.find).length - 1; if (!e.find || n !== 1) problems.push(`edit #${i + 1}: ${n === 0 ? "not found" : `occurs ${n} times`}`); else content = content!.replace(e.find, () => e.replace); });
      if (problems.length) return `No changes applied:\n- ${problems.join("\n- ")}`;
      await sandbox.files.write(k!, content!); files[k!] = content!; return `Applied ${edits.length} edit(s)`;
    } });
  const read = createTool({ name: "readFiles", description: "Read files from the sandbox", parameters: z.object({ files: z.array(z.string()) }),
    handler: async ({ files }) => { steps.push("read"); const out = []; for (const f of files) out.push({ path: f, content: await sandbox.files.read(f).catch(() => "") }); return JSON.stringify(out); } });
  const terminal = createTool({ name: "terminal", description: "Use the terminal to run commands", parameters: z.object({ command: z.string() }),
    handler: async ({ command }) => { steps.push("terminal"); const r = await sandbox.commands.run(command, { timeoutMs: 60_000 }).catch((e) => e); return (r?.stdout || "") + (r?.stderr || ""); } });
  const search = createTool({ name: "webSearch", description: "Search the live web", parameters: z.object({ query: z.string() }), handler: async ({ query }) => { steps.push("search"); return searchWeb(query, 5); } });
  const webSearchOn = isWebSearchEnabled();

  const codeAgent = createAgent<S>({
    name: "code-agent", description: "builder",
    system: (webSearchOn ? WEB_SEARCH_INSTRUCTIONS + "\n\n" : "") + (isApp ? MOBILE_APP_PROMPT : getTechSpecificPrompt("html-css-js")) + "\n\n" + EDIT_TOOL_RULES,
    model: model(isApp ? "low" : "low"), tools: webSearchOn ? [terminal, write, edit, read, search] : [terminal, write, edit, read],
    lifecycle: {
      onStart: async ({ prompt, history, network }) => ({ prompt, history: inject(history ?? [], network?.state.results ?? [], codeFb), stop: false }),
      onResponse: async ({ result, network }) => {
        const t = lastText(result);
        if (t.includes("<task_summary>") && network) {
          if (qaRounds < 3) { const issues = qa(network.state.data.files); if (issues.length) { qaRounds++; qaIssues.push(issues); steps.push(`QA(${issues.length})`); codeFb.push({ afterResults: network.state.results.length + 1, text: formatValidationFeedback(issues) }); return result; } }
          network.state.data.summary = t;
        }
        return result;
      },
    },
  });
  const reviewer = createAgent<S>({
    name: "code-reviewer", description: "reviewer", system: CODE_REVIEWER_PROMPT + "\n\n" + EDIT_TOOL_RULES, model: model("medium"), tools: [write, edit, read],
    lifecycle: {
      onStart: async ({ prompt, network }) => {
        if (!initialBrowser) { steps.push("browser"); initialBrowser = await browser(true); }
        const files = Object.keys(network?.state.data.files || {});
        const intro: Message = { type: "text", role: "user", content: `USER'S ORIGINAL REQUEST:\n${c.prompt}\n\nTECH STACK: ${isApp ? "mobile web app (single index.html)" : "html-css-js"}\n\nTHE BUILDER AGENT REPORTS:\n${network?.state.data.summary}\n\nPROJECT FILES: ${files.join(", ")}\n\n${initialBrowser && !initialBrowser.skipped ? formatBrowserFindings(initialBrowser) + "\n\n" : ""}Review the project now: read every file completely, fix every bug (start with any browser errors above), then address the design review.` };
        const own = (network?.state.results ?? []).filter((r) => r.agentName === "code-reviewer");
        return { prompt, history: inject([intro, ...own.flatMap(fmt)], own, revFb), stop: false };
      },
      onResponse: async ({ result, network }) => {
        const t = lastText(result);
        if (t.includes("<review_summary>") && network) {
          const own = () => network.state.results.filter((r) => r.agentName === "code-reviewer").length;
          if (reviewQaRounds < 3) { const issues = qa(network.state.data.files); if (issues.length) { reviewQaRounds++; qaIssues.push(issues); steps.push(`R:QA(${issues.length})`); revFb.push({ afterResults: own() + 1, text: formatValidationFeedback(issues) }); return result; } }
          if (initialBrowser && !initialBrowser.skipped && browserFixRounds < 1) {
            steps.push("browser");
            const fin = await browser(false);
            if (!fin.skipped && fin.runtimeIssues.length) { browserFixRounds++; steps.push(`B:FIX(${fin.runtimeIssues.length})`); revFb.push({ afterResults: own() + 1, text: formatBrowserFindings(fin) + "\n\nFix these now, then reply with your <review_summary> again." }); return result; }
          }
          reviewDone = true; reviewSummary = t;
        }
        return result;
      },
    },
  });
  const network = createNetwork<S>({ name: "eval", agents: [codeAgent, reviewer], maxIter: 40, defaultState: createState<S>({ summary: "", files: {} }),
    router: async ({ network }) => { if (!network.state.data.summary) return codeAgent; if (!reviewDone && Object.keys(network.state.data.files).length) return reviewer; return undefined; } });

  try {
    const prompt = isApp ? `${c.prompt}\n\n---\nFIRST BUILD: deliver the complete app in this pass inside index.html — every screen this app needs (decided from its purpose, not a fixed template), all fully working. No placeholder screens or "coming soon".` : c.prompt;
    const r = await network.run(prompt);
    const files = r.state.data.files;
    // Final scoring: static QA + a fresh browser run with design critique
    const finalStatic = qa(files);
    const finalBrowser = await browser(true);
    const dir = path.join(OUT_DIR, c.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const [p, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, path.basename(p)), content);
    const looksGood = !!finalBrowser.designNotes && /^\s*[-*]?\s*LOOKS GOOD/i.test(finalBrowser.designNotes);
    const score =
      (r.state.data.summary ? 20 : 0) +
      (finalStatic.length === 0 ? 25 : Math.max(0, 25 - finalStatic.length * 8)) +
      (finalBrowser.skipped ? 0 : finalBrowser.runtimeIssues.length === 0 ? 35 : Math.max(0, 35 - finalBrowser.runtimeIssues.length * 12)) +
      (looksGood ? 20 : finalBrowser.designNotes ? 8 : 0);
    return {
      id: c.id, mode: c.mode, prompt: c.prompt, ok: true, score, seconds: Math.round((Date.now() - t0) / 1000),
      steps: steps.join(" > "), qaRoundsIssues: qaIssues, finalStaticIssues: finalStatic,
      browserSkipped: finalBrowser.skipped ?? null, finalRuntimeIssues: finalBrowser.runtimeIssues, designNotes: finalBrowser.designNotes,
      reviewSummary: reviewSummary.replace(/<\/?review_summary>/g, "").trim(), usage: usage.get(c.id) ?? null,
    };
  } catch (e) {
    return { id: c.id, mode: c.mode, prompt: c.prompt, ok: false, score: 0, seconds: Math.round((Date.now() - t0) / 1000), steps: steps.join(" > "), error: String(e) };
  } finally {
    await sandbox.kill().catch(() => {});
  }
}

// ---------- runner + report ----------
(async () => {
  for (const k of ["OPENAI_API_KEY", "E2B_API_KEY"]) if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); }
  const all: Case[] = JSON.parse(fs.readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
  const cases = all.filter((c) => !ONLY || ONLY.includes(c.id)).slice(0, LIMIT);
  console.log(`▶ Evaluating ${cases.length} prompt(s), concurrency ${CONCURRENCY}, model ${MODEL}`);
  const bridge = await startBridge();
  const results: Awaited<ReturnType<typeof buildCase>>[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cases.length) }, async () => {
    while (next < cases.length) {
      const c = cases[next++];
      console.log(`… ${c.id}`);
      const r = await buildCase(c, bridge.url(c.id));
      results.push(r);
      console.log(`${r.ok ? "✓" : "✗"} ${c.id}: score ${r.score} (${r.seconds}s)`);
    }
  }));
  bridge.close();

  results.sort((a, b) => a.id.localeCompare(b.id));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  const avg = results.reduce((s, r) => s + r.score, 0) / Math.max(1, results.length);
  const tokens = results.reduce((s, r) => s + ((r as { usage?: { input: number; output: number } | null }).usage ? (r as { usage: { input: number; output: number } }).usage.input + (r as { usage: { input: number; output: number } }).usage.output : 0), 0);
  const md = [
    `# Genetix eval — ${new Date().toISOString()}`,
    ``,
    `Model: ${MODEL} · Prompts: ${results.length} · **Average score: ${avg.toFixed(1)}/100** · Total tokens: ${tokens.toLocaleString()}`,
    ``,
    `Score = finished (20) + static QA clean (25) + browser runtime clean (35) + design review "LOOKS GOOD" (20, or 8 with notes).`,
    ``,
    `| Case | Mode | Score | Time | Static issues | Runtime issues | Steps |`,
    `|---|---|---|---|---|---|---|`,
    ...results.map((r) => {
      const x = r as Record<string, unknown>;
      return `| ${r.id} | ${r.mode} | ${r.score} | ${r.seconds}s | ${((x.finalStaticIssues as string[]) || []).length} | ${x.browserSkipped ? "skipped" : ((x.finalRuntimeIssues as string[]) || []).length} | ${String(x.steps || "").slice(0, 80)} |`;
    }),
    ``,
    `## Details`,
    ...results.map((r) => {
      const x = r as Record<string, unknown>;
      return [`### ${r.id} — ${r.score}/100`, `> ${r.prompt}`, ``,
        x.error ? `**Error:** ${x.error}` : "",
        ((x.finalStaticIssues as string[]) || []).length ? `**Static issues:**\n${(x.finalStaticIssues as string[]).map((i) => `- ${i}`).join("\n")}` : "",
        ((x.finalRuntimeIssues as string[]) || []).length ? `**Runtime issues:**\n${(x.finalRuntimeIssues as string[]).map((i) => `- ${i}`).join("\n")}` : "",
        x.designNotes ? `**Design review:**\n${x.designNotes}` : "",
        x.reviewSummary ? `**Reviewer:**\n${x.reviewSummary}` : "",
      ].filter(Boolean).join("\n\n");
    }),
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);
  console.log(`\nAverage score ${avg.toFixed(1)}/100 — report: ${path.join(OUT_DIR, "report.md")}`);
})().catch((e) => { console.error(e); process.exit(1); });
