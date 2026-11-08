// Real-browser QA for generated projects, run INSIDE the E2B sandbox with Playwright.
// Loads the project like a user would (desktop + phone), records runtime errors, failed
// requests, blank pages and mobile overflow, plays it briefly (start button, keys, clicks),
// takes screenshots, then asks a vision model for a design critique of those screenshots.
//
// Requires Playwright + Chromium in the sandbox image (see sandbox-templates/nextjs/e2b.Dockerfile).
// If they're missing the check is skipped (or installed at runtime when
// BROWSER_QA_RUNTIME_INSTALL=true — slow, ~1-2 min per new sandbox).

import type { Sandbox } from "@e2b/code-interpreter";
import { recordBuildUsage } from "@/lib/build-tracker";

const QA_DIR = "/opt/genetix-qa";
const RESULT_MARKER = "__GX_QA__";

export interface BrowserQaResult {
  skipped?: string;
  runtimeIssues: string[];
  designNotes: string | null;
}

interface ViewportReport {
  errors: string[];
  failedRequests: string[];
  screenshot: string;
  afterInteraction: string | null;
  metrics: { textLength: number; canvases: number; overflowX: boolean; controls: number };
  audio: { contexts: number; nodes: number } | null;
}

// Node ESM script executed in the sandbox. Kept dependency-free apart from playwright-core.
const QA_SCRIPT = String.raw`
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
const { chromium } = await import("${QA_DIR}/node_modules/playwright-core/index.mjs");

const mode = process.argv[2];          // "static" | "next"
const primary = process.argv[3];       // "desktop" | "mobile"
const ROOT = "/home/user";
let baseUrl = "http://localhost:3000/";
let server = null;

if (mode === "static") {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
  server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end("not found"); }
  });
  await new Promise((r) => server.listen(4173, r));
  baseUrl = "http://localhost:4173/index.html";
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });

async function runViewport(name, viewport, interact) {
  const ctx = await browser.newContext({ viewport, hasTouch: name === "mobile", isMobile: name === "mobile" });
  await ctx.addInitScript(() => {
    window.__gxAudio = { contexts: 0, nodes: 0 };
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    for (const m of ["createOscillator", "createBufferSource"]) {
      const orig = AC.prototype[m];
      if (orig) AC.prototype[m] = function (...a) { window.__gxAudio.nodes++; return orig.apply(this, a); };
    }
    const Wrapped = function (...a) { window.__gxAudio.contexts++; return new AC(...a); };
    Wrapped.prototype = AC.prototype;
    window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
  });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on("pageerror", (e) => errors.push("Uncaught error: " + String(e.message).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => { if (!/favicon/.test(r.url())) failed.push(r.url().slice(0, 200) + " (" + (r.failure()?.errorText || "failed") + ")"); });
  page.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) failed.push(r.url().slice(0, 200) + " (HTTP " + r.status() + ")"); });
  await page.goto(baseUrl, { waitUntil: "load", timeout: mode === "next" ? 90000 : 30000 }).catch((e) => errors.push("Page failed to load: " + e.message.slice(0, 200)));
  await page.waitForTimeout(mode === "next" ? 4000 : 1500);
  const screenshot = (await page.screenshot({ type: "jpeg", quality: 55 })).toString("base64");
  const metrics = await page.evaluate(() => ({
    textLength: (document.body?.innerText || "").trim().length,
    canvases: document.querySelectorAll("canvas").length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    controls: document.querySelectorAll("button, [role=button], a[href], input, select, textarea").length,
  })).catch(() => ({ textLength: 0, canvases: 0, overflowX: false, controls: 0 }));
  let afterInteraction = null;
  if (interact) {
    const start = page.locator("button:visible, [role=button]:visible, a:visible").filter({ hasText: /start|play|begin|launch|enter|new game|get started|let'?s go|continue/i }).first();
    if (await start.count().catch(() => 0)) await start.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    for (const k of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Space", "w", "a", "s", "d", "Enter"]) {
      await page.keyboard.press(k).catch(() => {}); await page.waitForTimeout(70);
    }
    const buttons = await page.$$("button:visible");
    for (const b of buttons.slice(0, 10)) { await b.click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(120); }
    await page.waitForTimeout(800);
    afterInteraction = (await page.screenshot({ type: "jpeg", quality: 55 })).toString("base64");
  }
  const audio = await page.evaluate(() => window.__gxAudio || null).catch(() => null);
  await ctx.close();
  return { errors: [...new Set(errors)].slice(0, 15), failedRequests: [...new Set(failed)].slice(0, 10), screenshot, afterInteraction, metrics, audio };
}

const desktop = await runViewport("desktop", { width: 1280, height: 800 }, primary === "desktop");
const mobile = await runViewport("mobile", { width: 390, height: 844 }, primary === "mobile");
await browser.close();
if (server) server.close();
console.log("${RESULT_MARKER}" + JSON.stringify({ desktop, mobile }));
`;

async function ensurePlaywright(sandbox: Sandbox): Promise<string | null> {
  const check = await sandbox.commands
    .run(`test -f ${QA_DIR}/node_modules/playwright-core/index.mjs && ls ${QA_DIR}/browsers 2>/dev/null | grep -q chromium && echo READY || echo MISSING`, { timeoutMs: 10_000 })
    .catch(() => null);
  if (check?.stdout?.includes("READY")) return null;
  if (process.env.BROWSER_QA_RUNTIME_INSTALL !== "true") {
    return "the sandbox image has no browser (rebuild the E2B template from sandbox-templates/nextjs to enable browser testing)";
  }
  try {
    await sandbox.commands.run(
      `sudo mkdir -p ${QA_DIR} && sudo chown -R $(whoami) ${QA_DIR} && cd ${QA_DIR} && (test -f package.json || npm init -y >/dev/null) && ` +
        `npm i playwright-core@1.49.1 --silent && sudo PLAYWRIGHT_BROWSERS_PATH=${QA_DIR}/browsers npx --yes playwright-core@1.49.1 install --with-deps chromium && sudo chown -R $(whoami) ${QA_DIR}`,
      { timeoutMs: 240_000 }
    );
    return null;
  } catch (e) {
    return "browser install failed: " + (e instanceof Error ? e.message : String(e)).slice(0, 200);
  }
}

async function critiqueDesign(
  report: { desktop: ViewportReport; mobile: ViewportReport },
  userRequest: string,
  primary: "desktop" | "mobile",
  buildId: string | null
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const main = report[primary];
  const images = [main.screenshot, main.afterInteraction, primary === "desktop" ? report.mobile.screenshot : null].filter(Boolean) as string[];
  const content = [
    {
      type: "input_text",
      text:
        `You are a senior product designer reviewing screenshots of a project an AI just built.\n` +
        `USER'S REQUEST:\n${userRequest.slice(0, 2000)}\n\n` +
        `Screenshots: ${primary} first load${main.afterInteraction ? ", after clicking start/pressing keys" : ""}${primary === "desktop" ? ", phone (390px)" : ""}.\n\n` +
        `List the most important CONCRETE problems (max 8 short bullets), most important first:\n` +
        `- Does it show what was asked (right type — e.g. a game shows the playable game, not a landing page; a tool shows the working tool)? Anything requested missing?\n` +
        `- Blank/broken areas, nothing happening after start, overlapping or cut-off elements, unreadable text/low contrast, layout broken on phone.\n` +
        `- Generic/template look; weak hierarchy, spacing or polish.\n` +
        `Say exactly what to change. If it already looks good, start with "LOOKS GOOD" and give at most 3 polish ideas.`,
    },
    ...images.map((b64) => ({ type: "input_image", image_url: `data:image/jpeg;base64,${b64}` })),
  ];
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 90_000);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DESIGN_REVIEW_MODEL || "gpt-6-luna",
        reasoning: { effort: "low" },
        max_output_tokens: 1500,
        store: false,
        input: [{ role: "user", content }],
      }),
    }).finally(() => clearTimeout(t));
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    if (buildId && data.usage) {
      await recordBuildUsage(buildId, {
        input: data.usage.input_tokens ?? 0,
        cached: data.usage.input_tokens_details?.cached_tokens ?? 0,
        output: data.usage.output_tokens ?? 0,
        reasoning: data.usage.output_tokens_details?.reasoning_tokens ?? 0,
      });
    }
    const text = (data.output || [])
      .filter((o: { type: string }) => o.type === "message")
      .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content || [])
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text?: string }) => c.text || "")
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

function summarizeRuntime(report: { desktop: ViewportReport; mobile: ViewportReport }, primary: "desktop" | "mobile", isGame: boolean): string[] {
  const issues: string[] = [];
  const main = report[primary];
  const errs = [...new Set([...main.errors, ...report[primary === "desktop" ? "mobile" : "desktop"].errors])];
  if (errs.length) issues.push(`Runtime errors in the browser (fix the root cause of each):\n  ${errs.slice(0, 10).join("\n  ")}`);
  const failed = [...new Set([...main.failedRequests, ...report.mobile.failedRequests])];
  if (failed.length) issues.push(`Resources failed to load (fix or remove these references):\n  ${failed.slice(0, 8).join("\n  ")}`);
  if (main.metrics.textLength < 20 && main.metrics.canvases === 0) issues.push("The page renders blank (almost no visible content and no canvas) on first load.");
  if (report.mobile.metrics.overflowX) issues.push("On a 390px-wide phone the page scrolls sideways (horizontal overflow). Make the layout fit the screen.");
  if (isGame && main.audio && main.audio.contexts > 0 && main.audio.nodes === 0) {
    issues.push("The game creates an AudioContext but never plays any sound during play (no music or effects were triggered after starting and pressing keys).");
  }
  return issues;
}

/**
 * Run browser QA + design critique. Never throws; returns `skipped` with a reason when it can't run.
 * mode: "static" (serve /home/user) or "next" (Next.js dev server on :3000).
 */
export async function runBrowserQa(
  sandbox: Sandbox,
  opts: { mode: "static" | "next"; primary: "desktop" | "mobile"; userRequest: string; isGame: boolean; buildId: string | null; withDesignReview: boolean }
): Promise<BrowserQaResult> {
  try {
    const missing = await ensurePlaywright(sandbox);
    if (missing) return { skipped: missing, runtimeIssues: [], designNotes: null };

    // Unique path per run: re-writing the same /tmp file can fail with "permission denied"
    const scriptPath = `/tmp/genetix-qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mjs`;
    await sandbox.files.write(scriptPath, QA_SCRIPT);
    let stdout = "";
    try {
      const run = await sandbox.commands.run(
        `cd /tmp && PLAYWRIGHT_BROWSERS_PATH=${QA_DIR}/browsers timeout 170 node ${scriptPath} ${opts.mode} ${opts.primary}; rm -f ${scriptPath}`,
        { timeoutMs: 180_000 }
      );
      stdout = run.stdout || "";
    } catch (e) {
      // CommandExitError still carries stdout
      stdout = (e as { stdout?: string })?.stdout || "";
      if (!stdout.includes(RESULT_MARKER)) {
        return { skipped: "browser run failed: " + (e instanceof Error ? e.message : String(e)).slice(0, 200), runtimeIssues: [], designNotes: null };
      }
    }
    const idx = stdout.lastIndexOf(RESULT_MARKER);
    if (idx === -1) return { skipped: "browser run produced no report", runtimeIssues: [], designNotes: null };
    const report = JSON.parse(stdout.slice(idx + RESULT_MARKER.length).trim().split("\n")[0]) as { desktop: ViewportReport; mobile: ViewportReport };

    const runtimeIssues = summarizeRuntime(report, opts.primary, opts.isGame);
    const designNotes = opts.withDesignReview ? await critiqueDesign(report, opts.userRequest, opts.primary, opts.buildId) : null;
    return { runtimeIssues, designNotes };
  } catch (e) {
    return { skipped: "browser QA error: " + (e instanceof Error ? e.message : String(e)).slice(0, 200), runtimeIssues: [], designNotes: null };
  }
}

export function formatBrowserFindings(r: BrowserQaResult): string {
  const parts: string[] = [];
  if (r.runtimeIssues.length) {
    parts.push("REAL-BROWSER TEST RESULTS (the project was loaded in Chromium, started and played/clicked):", ...r.runtimeIssues.map((i) => `- ${i}`));
  } else {
    parts.push("REAL-BROWSER TEST: no runtime errors, failed requests, blank page or mobile overflow detected.");
  }
  if (r.designNotes) parts.push("", "DESIGN REVIEW OF THE SCREENSHOTS (by a product designer):", r.designNotes);
  return parts.join("\n");
}
