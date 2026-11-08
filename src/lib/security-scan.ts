// Static security scan for generated projects (run before publishing).
// Pure and dependency-free: regex heuristics over the project's text files.

import { normalizePath } from "@/lib/static-html";

export type SecuritySeverity = "high" | "medium" | "low";

export interface SecurityFinding {
  severity: SecuritySeverity;
  title: string;
  file: string;
  line?: number;
  detail: string;
  fixHint: string;
}

export interface SecurityScanResult {
  findings: SecurityFinding[];
  /** True when there are no high- or medium-severity findings */
  passed: boolean;
}

const SEVERITY_ORDER: Record<SecuritySeverity, number> = { high: 0, medium: 1, low: 2 };

const MAX_FILE_LENGTH = 2 * 1024 * 1024;
const MAX_FINDINGS = 200;

/** Show only the first 4 characters of a secret */
export const maskSecret = (value: string) => (value.length <= 4 ? "…" : value.slice(0, 4) + "…");

const isTextFile = (path: string, content: string) =>
  /\.(html?|css|m?js|cjs|jsx|tsx?|vue|svelte|json|env|txt|md|ya?ml|toml|xml)$/i.test(path) &&
  !/^data:/i.test(content.slice(0, 10));

const SECRET_BACKEND_HINT =
  "Remove the secret from the front-end code and rotate it. Call the API from a server/edge function (e.g. a Supabase Edge Function) that keeps the key private.";

interface SecretPattern {
  id: string;
  re: RegExp;
  severity: SecuritySeverity;
  title: string;
  /** Extra validation of the match (e.g. must contain a digit) */
  accept?: (match: string) => boolean;
}

const hasDigitAndLetter = (s: string) => /\d/.test(s) && /[a-z]/i.test(s);

const SECRET_PATTERNS: SecretPattern[] = [
  { id: "openai", re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g, severity: "high", title: "OpenAI API key", accept: hasDigitAndLetter },
  { id: "anthropic", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, severity: "high", title: "Anthropic API key" },
  { id: "stripe", re: /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}/g, severity: "high", title: "Stripe secret key" },
  { id: "aws", re: /\bAKIA[0-9A-Z]{16}\b/g, severity: "high", title: "AWS access key" },
  { id: "github", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/g, severity: "high", title: "GitHub token" },
  { id: "google", re: /\bAIza[0-9A-Za-z_-]{35}/g, severity: "medium", title: "Google API key" },
  { id: "private-key", re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g, severity: "high", title: "Private key" },
];

const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

function decodeBase64Url(segment: string): string | null {
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
    if (typeof atob === "function") return atob(b64);
    return Buffer.from(b64, "base64").toString("binary");
  } catch {
    return null;
  }
}

/** The `role` claim of a JWT, if decodable */
export function jwtRole(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  const json = decodeBase64Url(payload);
  if (!json) return null;
  try {
    const data = JSON.parse(json) as { role?: unknown };
    return typeof data.role === "string" ? data.role : null;
  } catch {
    return null;
  }
}

const GENERIC_SECRET_RE =
  /\b(api[_-]?key|apikey|secret(?:[_-]?key)?|client[_-]?secret|password|passwd|pwd|auth[_-]?token|access[_-]?token|private[_-]?key)\b["']?\s*[:=]\s*(["'`])([^"'`\s]{12,})\2/gi;

const PLACEHOLDER_RE = /your|xxx|example|placeholder|changeme|dummy|test|<|>|\$\{|\*{3}|\.{3}|process\.env|import\.meta/i;

const DOM_SOURCES_RE = /location\.(?:search|hash|href|pathname)|document\.(?:URL|referrer|documentURI)|URLSearchParams|searchParams|\.value\b|window\.name/;
const DOM_SINK_RE = /\.(?:innerHTML|outerHTML)\s*\+?=|\.insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(/;

const STORAGE_SENSITIVE_RE =
  /\b(?:localStorage|sessionStorage)\s*(?:\.setItem\s*\(\s*["'`][^"'`]*(?:token|password|passwd|secret|jwt|session|auth)[^"'`]*["'`]|\.(?:token|password|secret|jwt|authToken|accessToken)\s*=|\[\s*["'`][^"'`]*(?:token|password|secret|jwt)[^"'`]*["'`]\s*\]\s*=)/i;

interface LineIndex {
  lineAt: (offset: number) => number;
  lines: string[];
}

function indexLines(content: string): LineIndex {
  const starts: number[] = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) starts.push(i + 1);
  return {
    lines: content.split("\n"),
    lineAt: (offset: number) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
  };
}

export function scanSecurity(files: Record<string, string>): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();
  const add = (f: SecurityFinding) => {
    const key = `${f.title}|${f.file}|${f.line ?? ""}|${f.detail}`;
    if (seen.has(key) || findings.length >= MAX_FINDINGS) return;
    seen.add(key);
    findings.push(f);
  };

  for (const [rawPath, content] of Object.entries(files ?? {})) {
    if (typeof content !== "string" || content.length > MAX_FILE_LENGTH) continue;
    const file = normalizePath(rawPath);
    if (/(^|\/)(node_modules|\.next|dist)\//.test(file) || /package-lock\.json$|\.lock$/.test(file)) continue;
    if (!isTextFile(file, content)) continue;

    const { lines, lineAt } = indexLines(content);
    const isHtml = /\.html?$/i.test(file);
    const isScriptLike = /\.(m?js|cjs|jsx|tsx?|vue|svelte)$/i.test(file) || isHtml;
    const secretLines = new Set<number>();

    // --- Hard-coded secrets ---------------------------------------------
    for (const p of SECRET_PATTERNS) {
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(content))) {
        if (p.accept && !p.accept(m[0])) continue;
        // sk-ant-… also matches the OpenAI pattern
        if (p.id === "openai" && m[0].startsWith("sk-ant-")) continue;
        const line = lineAt(m.index);
        secretLines.add(line);
        add({
          severity: p.severity,
          title: `Hard-coded ${p.title}`,
          file,
          line,
          detail:
            p.id === "private-key"
              ? "A private key is embedded in the project and would be public once published."
              : `Found ${maskSecret(m[0])} in the code; anyone visiting the site can read it.`,
          fixHint:
            p.id === "google"
              ? "If this is a browser key, restrict it to your domain and the APIs you use in Google Cloud Console; otherwise move it to a server function."
              : SECRET_BACKEND_HINT,
        });
      }
    }

    JWT_RE.lastIndex = 0;
    let jwt: RegExpExecArray | null;
    while ((jwt = JWT_RE.exec(content))) {
      const role = jwtRole(jwt[0]);
      if (role !== "service_role") continue;
      const line = lineAt(jwt.index);
      secretLines.add(line);
      add({
        severity: "high",
        title: "Supabase service_role key exposed",
        file,
        line,
        detail: `A JWT with role "service_role" (${maskSecret(jwt[0])}) bypasses all Row Level Security.`,
        fixHint: "Use the anon key in the browser and rotate the service_role key immediately. Only use service_role inside server/edge functions.",
      });
    }

    GENERIC_SECRET_RE.lastIndex = 0;
    let g: RegExpExecArray | null;
    while ((g = GENERIC_SECRET_RE.exec(content))) {
      const value = g[3];
      const line = lineAt(g.index);
      if (secretLines.has(line) || PLACEHOLDER_RE.test(value)) continue;
      // Skip DOM ids/selectors like password = "#password-input"
      if (/^[#.]/.test(value)) continue;
      add({
        severity: "medium",
        title: `Possible hard-coded ${g[1].toLowerCase()}`,
        file,
        line,
        detail: `${g[1]} is set to a literal value (${maskSecret(value)}).`,
        fixHint: SECRET_BACKEND_HINT,
      });
    }

    // --- Line-based heuristics ------------------------------------------
    // Variables assigned from user-controlled sources (simple same-file taint)
    const tainted = new Set<string>();
    if (isScriptLike) {
      const taintRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)/g;
      let t: RegExpExecArray | null;
      while ((t = taintRe.exec(content))) if (DOM_SOURCES_RE.test(t[2])) tainted.add(t[1]);
    }

    lines.forEach((text, i) => {
      const line = i + 1;
      if (text.length > 5000) return; // minified blobs / inline data

      if (isScriptLike) {
        if (/(^|[^\w$.])eval\s*\(/.test(text)) {
          add({
            severity: "medium",
            title: "Use of eval()",
            file,
            line,
            detail: "eval() runs arbitrary strings as code and enables script injection.",
            fixHint: "Replace eval() with JSON.parse or explicit logic.",
          });
        }
        if (/\bnew\s+Function\s*\(/.test(text)) {
          add({
            severity: "medium",
            title: "Use of new Function()",
            file,
            line,
            detail: "new Function() compiles strings into code (same risk as eval).",
            fixHint: "Replace new Function() with regular functions.",
          });
        }
        if (/\bset(?:Timeout|Interval)\s*\(\s*["'`]/.test(text)) {
          add({
            severity: "low",
            title: "String passed to setTimeout/setInterval",
            file,
            line,
            detail: "Passing a string makes the browser eval it.",
            fixHint: "Pass a function instead, e.g. setTimeout(() => doThing(), 500).",
          });
        }
        if (DOM_SINK_RE.test(text)) {
          const direct = DOM_SOURCES_RE.test(text);
          const viaVar = !direct && Array.from(tainted).some((v) => new RegExp(`(^|[^\\w$])${v.replace(/\$/g, "\\$")}([^\\w$]|$)`).test(text.split(DOM_SINK_RE)[1] ?? ""));
          if (direct || viaVar) {
            add({
              severity: "high",
              title: "Possible DOM-based XSS",
              file,
              line,
              detail: "HTML is written with innerHTML/insertAdjacentHTML/document.write using a value from the URL or user input.",
              fixHint: "Use textContent (or create elements) for user-provided values, or sanitise them before inserting HTML.",
            });
          }
        }
        if (STORAGE_SENSITIVE_RE.test(text)) {
          add({
            severity: "medium",
            title: "Sensitive data in browser storage",
            file,
            line,
            detail: "A token/password appears to be stored in localStorage/sessionStorage, readable by any script on the page.",
            fixHint: "Never store passwords. Let the auth provider (e.g. Supabase) manage sessions instead of saving tokens yourself.",
          });
        }
      }

      if (isHtml) {
        const mixed = /<(script|iframe|img|link|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*["']?http:\/\/(?!localhost|127\.0\.0\.1)/i.exec(text);
        if (mixed) {
          const tag = mixed[1].toLowerCase();
          const active = tag === "script" || tag === "iframe" || (tag === "link" && /stylesheet/i.test(text));
          add({
            severity: active ? "medium" : "low",
            title: "Insecure http:// resource (mixed content)",
            file,
            line,
            detail: `A <${tag}> loads over plain http://; browsers block or warn about it on an https site.`,
            fixHint: "Change the URL to https://.",
          });
        }
        if (/<form\b[^>]*\baction\s*=\s*["']?http:\/\/(?!localhost|127\.0\.0\.1)/i.test(text)) {
          add({
            severity: "high",
            title: "Form submits over http://",
            file,
            line,
            detail: "Form data (possibly passwords or personal data) would be sent unencrypted.",
            fixHint: "Change the form action to an https:// URL.",
          });
        }
        const blankRe = /<a\b[^>]*>/gi;
        let a: RegExpExecArray | null;
        while ((a = blankRe.exec(text))) {
          if (!/\btarget\s*=\s*["']?_blank/i.test(a[0])) continue;
          if (/\brel\s*=\s*["'][^"']*\b(noopener|noreferrer)\b/i.test(a[0])) continue;
          add({
            severity: "low",
            title: 'target="_blank" without rel="noopener"',
            file,
            line,
            detail: "The opened page can access window.opener in older browsers (reverse tabnabbing).",
            fixHint: 'Add rel="noopener noreferrer" to links with target="_blank".',
          });
          break;
        }
      }
    });
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0),
  );

  return { findings, passed: !findings.some((f) => f.severity === "high" || f.severity === "medium") };
}

/** One quick-edit request that fixes the findings (secrets are never echoed back in full). */
export function buildSecurityFixRequest(findings: SecurityFinding[]): string {
  if (!findings.length) return "";
  const lines = findings.map(
    (f, i) => `${i + 1}) [${f.severity}] ${f.title} in ${f.file}${f.line ? ` line ${f.line}` : ""}: ${f.fixHint}`,
  );
  return `Fix these security issues without changing the design or behaviour of the site. Remove any hard-coded secrets (replace them with a clearly marked placeholder or a call to a server function):\n${lines.join("\n")}`.slice(0, 9000);
}
