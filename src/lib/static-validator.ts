// Automated QA for generated static projects (HTML/CSS/JS websites and mobile apps).
// Catches the bugs that make generated projects "look done but not work":
// JS syntax errors, inline handlers calling undefined functions, getElementById on ids
// that don't exist, links to pages/files that weren't created, and placeholder content.
// Results are fed back to the code agent so it fixes them before the build is accepted.

import vm from "vm";

export type StaticFiles = Record<string, string>;

const normalize = (p: string) => p.replace(/^\.?\/+/, "").replace(/^home\/user\//, "");

// Identifiers that are fine to call from inline handlers without being user-defined
const BUILTIN_CALLS = new Set([
  "if", "for", "while", "switch", "return", "function", "typeof", "new", "catch", "await", "async",
  "alert", "confirm", "prompt", "console", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame", "parseInt", "parseFloat", "Number", "String", "Boolean",
  "Array", "Object", "JSON", "Math", "Date", "encodeURIComponent", "decodeURIComponent", "fetch", "event",
  "history", "location", "document", "window", "this", "open", "close", "print", "scrollTo", "scrollBy",
  "isNaN", "isFinite", "Promise", "structuredClone", "navigator", "localStorage", "sessionStorage",
]);

interface ScriptChunk { name: string; code: string; isModule: boolean }

function extractInlineScripts(html: string, fileName: string): ScriptChunk[] {
  const chunks: ScriptChunk[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "";
    if (/\bsrc\s*=/.test(attrs)) continue;
    const type = attrs.match(/type\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !["text/javascript", "application/javascript", "module"].includes(type)) continue; // JSON-LD, templates…
    chunks.push({ name: `${fileName} <script #${++i}>`, code: m[2], isModule: type === "module" });
  }
  return chunks;
}

function syntaxError(code: string, isModule: boolean): string | null {
  if (isModule || /^\s*(import|export)\s/m.test(code)) return null; // vm.Script can't parse ESM
  try {
    new vm.Script(code);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function definedNames(code: string): Set<string> {
  const names = new Set<string>();
  const patterns = [
    /function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /window\.([A-Za-z_$][\w$]*)\s*=/g,
    /globalThis\.([A-Za-z_$][\w$]*)\s*=/g,
    /class\s+([A-Za-z_$][\w$]*)/g,
    /^\s*([A-Za-z_$][\w$]*)\s*=\s*(?:function|\(|async)/gm,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) names.add(m[1]);
  }
  return names;
}

function definedIds(html: string, allJs: string): Set<string> {
  const ids = new Set<string>();
  const add = (re: RegExp, text: string) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) if (!m[1].includes("${")) ids.add(m[1]);
  };
  add(/\bid\s*=\s*["']([^"']+)["']/gi, html);
  add(/\bid\s*=\s*\\?["'`]([^"'`\\]+)\\?["'`]/gi, allJs); // id="x" inside JS template strings
  add(/\.id\s*=\s*["'`]([^"'`]+)["'`]/g, allJs);
  add(/setAttribute\(\s*["']id["']\s*,\s*["'`]([^"'`]+)["'`]/g, allJs);
  return ids;
}

/**
 * Returns a list of human-readable problems (empty = looks OK). Capped to keep feedback focused.
 */
export function validateStaticProject(files: StaticFiles, opts: { singleFileApp?: boolean } = {}): string[] {
  const issues: string[] = [];
  const textFiles: StaticFiles = {};
  for (const [p, c] of Object.entries(files)) {
    if (typeof c === "string" && !c.startsWith("data:")) textFiles[normalize(p)] = c;
  }
  const existing = new Set(Object.keys(files).map(normalize));
  const htmlNames = Object.keys(textFiles).filter((f) => f.endsWith(".html"));
  if (htmlNames.length === 0) return ["No index.html was created. Create index.html as the entry point."];
  if (!existing.has("index.html")) issues.push("There is no index.html entry point.");

  if (opts.singleFileApp) {
    const extra = Object.keys(textFiles).filter((f) => f !== "index.html" && /\.(html|css|js)$/.test(f));
    if (extra.length) issues.push(`Mobile apps must keep ALL code inside index.html, but these extra files exist: ${extra.join(", ")}. Inline them into index.html.`);
  }

  // Collect JS
  const scripts: ScriptChunk[] = [];
  for (const f of Object.keys(textFiles).filter((f) => f.endsWith(".js"))) {
    scripts.push({ name: f, code: textFiles[f], isModule: false });
  }
  for (const f of htmlNames) scripts.push(...extractInlineScripts(textFiles[f], f));
  const allJs = scripts.map((s) => s.code).join("\n");

  // 1) Syntax errors (a single one breaks ALL functionality in that file)
  for (const s of scripts) {
    const err = syntaxError(s.code, s.isModule);
    if (err) issues.push(`JavaScript syntax error in ${s.name}: "${err}". Nothing in this script runs until it's fixed.`);
  }

  const globals = new Set<string>();
  for (const s of scripts) if (!s.isModule) definedNames(s.code).forEach((n) => globals.add(n));
  const moduleOnly = new Set<string>();
  for (const s of scripts) if (s.isModule) definedNames(s.code).forEach((n) => { if (!globals.has(n)) moduleOnly.add(n); });

  for (const f of htmlNames) {
    const html = textFiles[f];
    const ids = definedIds(html, allJs);

    // 2) Inline handlers calling functions that don't exist (or are trapped in module scope)
    const handlerRe = /\son[a-z]+\s*=\s*"([^"]*)"|\son[a-z]+\s*=\s*'([^']*)'/gi;
    const reported = new Set<string>();
    let hm: RegExpExecArray | null;
    while ((hm = handlerRe.exec(html))) {
      const body = hm[1] ?? hm[2] ?? "";
      const callRe = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(body))) {
        const fn = cm[2];
        if (BUILTIN_CALLS.has(fn) || globals.has(fn) || reported.has(fn)) continue;
        reported.add(fn);
        issues.push(
          moduleOnly.has(fn)
            ? `${f}: inline handler calls ${fn}() but it is defined inside a type="module" script, so it is not global. Assign window.${fn} = ${fn} or use addEventListener.`
            : `${f}: inline handler calls ${fn}() but no function named ${fn} is defined anywhere.`
        );
      }
    }

    // 3) Local links / assets that point to files that were never created
    const refRe = /<(a|link|script|img|source|audio|video)\b[^>]*?\s(href|src)\s*=\s*["']([^"']+)["']/gi;
    let rm: RegExpExecArray | null;
    const missing = new Set<string>();
    const badAnchors = new Set<string>();
    while ((rm = refRe.exec(html))) {
      const url = rm[3].trim();
      if (/^(https?:|\/\/|data:|blob:|mailto:|tel:|javascript:)/i.test(url) || url === "#" || url === "") continue;
      if (url.startsWith("#")) {
        const id = url.slice(1);
        if (rm[1].toLowerCase() === "a" && id && !ids.has(id) && !html.includes(`name="${id}"`)) badAnchors.add(url);
        continue;
      }
      const clean = normalize(url.split("#")[0].split("?")[0]);
      if (clean && !existing.has(clean)) missing.add(clean);
    }
    if (missing.size) issues.push(`${f} references files that don't exist: ${[...missing].slice(0, 8).join(", ")}. Create them or remove/replace the references.`);
    if (badAnchors.size) issues.push(`${f} has links to sections that don't exist: ${[...badAnchors].slice(0, 8).join(", ")}. Add matching id="..." elements or fix the links.`);

    // 4) Placeholder / unfinished content
    if (/lorem ipsum/i.test(html)) issues.push(`${f} contains "Lorem ipsum" placeholder text. Replace it with real, relevant content.`);
    if (/coming soon|to be implemented|not implemented yet|\bTODO\b/i.test(html + allJs)) {
      issues.push(`The project contains unfinished placeholders ("coming soon" / "TODO" / "not implemented"). Implement those features.`);
    }

    // 5) getElementById / querySelector('#id') targets that never exist
    const allHtml = htmlNames.map((h) => textFiles[h]).join("\n");
    const allIds = definedIds(allHtml, allJs);
    const lookupRe = /getElementById\(\s*["'`]([\w-]+)["'`]\s*\)|querySelector(?:All)?\(\s*["'`]#([\w-]+)["'`]\s*\)/g;
    const missingIds = new Set<string>();
    let lm: RegExpExecArray | null;
    while ((lm = lookupRe.exec(allJs))) {
      const id = lm[1] ?? lm[2];
      if (!allIds.has(id)) missingIds.add(id);
    }
    if (missingIds.size && f === htmlNames[0]) {
      issues.push(`JavaScript looks up element ids that don't exist in the HTML: ${[...missingIds].slice(0, 10).map((i) => "#" + i).join(", ")}. Those lookups return null and crash (e.g. "Cannot read properties of null"). Add the elements or fix the ids.`);
    }
  }

  return Array.from(new Set(issues)).slice(0, 15);
}

export function formatValidationFeedback(issues: string[]): string {
  return [
    "AUTOMATED QA CHECK FAILED. Your project has these problems:",
    ...issues.map((i) => `- ${i}`),
    "",
    "Fix ALL of them now using createOrUpdateFiles (edit the affected parts; keep everything else working).",
    "Then double-check that every button, link, form and control actually works, and reply with your <task_summary> again.",
  ].join("\n");
}
