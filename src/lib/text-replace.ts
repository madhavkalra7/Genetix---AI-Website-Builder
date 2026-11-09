// Deterministic "change this text" for Visual Edits: find the element's current visible text in
// the project source and replace it — instant, free, no AI. Only succeeds when the text occurs
// exactly once (across HTML files, then JS string literals), so we never edit the wrong place.

export type TextReplaceResult =
  | { ok: true; files: Record<string, string>; file: string }
  | { ok: false; reason: "empty" | "not-found" | "ambiguous" };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Source pattern for visible text: whitespace may differ, entities may be used for & < > " ' and nbsp. */
function textPattern(text: string): RegExp {
  const ENTITY: Record<string, string> = {
    "&": "(?:&|&amp;|&#38;)",
    "<": "(?:<|&lt;|&#60;)",
    ">": "(?:>|&gt;|&#62;)",
    '"': '(?:"|&quot;|&#34;)',
    "'": "(?:'|&#39;|&apos;|’)",
    "’": "(?:’|'|&rsquo;|&#8217;)",
    " ": "(?:\\s|&nbsp;|&#160;)",
  };
  const parts = text
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("")
        .map((ch) => ENTITY[ch] ?? escapeRegExp(ch))
        .join("")
    );
  return new RegExp(parts.join("(?:\\s|&nbsp;|&#160;)+"), "g");
}

const isHtml = (p: string) => /\.html?$/i.test(p);
const isJs = (p: string) => /\.m?js$/i.test(p);

/** Strip <script>/<style> blocks and HTML comments when counting matches in HTML, so we only touch visible markup. */
function maskNonVisible(html: string): string {
  return html.replace(/<(script|style)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, (m) => " ".repeat(m.length));
}

export function replaceTextInFiles(files: Record<string, string>, from: string, to: string): TextReplaceResult {
  const fromText = from.replace(/\s+/g, " ").trim();
  const toText = to.replace(/\s+/g, " ").trim();
  if (!fromText || !toText) return { ok: false, reason: "empty" };

  const pattern = textPattern(fromText);

  // 1) Visible HTML text (outside <script>/<style>/comments)
  const htmlHits: { file: string; index: number; length: number }[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (!isHtml(file) || typeof content !== "string" || content.startsWith("data:")) continue;
    const masked = maskNonVisible(content);
    for (const m of masked.matchAll(pattern)) {
      // must sit in text content, not inside a tag's attributes: last "<" before it must be closed by ">"
      const before = masked.slice(0, m.index);
      if (before.lastIndexOf("<") > before.lastIndexOf(">")) continue;
      htmlHits.push({ file, index: m.index!, length: m[0].length });
    }
  }
  if (htmlHits.length > 1) return { ok: false, reason: "ambiguous" };
  if (htmlHits.length === 1) {
    const { file, index, length } = htmlHits[0];
    const content = files[file];
    return {
      ok: true,
      file,
      files: { ...files, [file]: content.slice(0, index) + escapeHtml(toText) + content.slice(index + length) },
    };
  }

  // 2) Text rendered from JS string literals ("…", '…', `…` without interpolation)
  if (/[`\\]|\$\{/.test(toText)) return { ok: false, reason: "not-found" };
  const jsHits: { file: string; index: number; length: number; quote: string }[] = [];
  const literal = escapeRegExp(fromText);
  const jsPattern = new RegExp(`(["'\`])${literal}\\1`, "g");
  for (const [file, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    const sources: { text: string; offset: number }[] = [];
    if (isJs(file)) sources.push({ text: content, offset: 0 });
    else if (isHtml(file)) {
      for (const m of content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        sources.push({ text: m[1], offset: m.index! + m[0].indexOf(m[1]) });
      }
    }
    for (const src of sources) {
      for (const m of src.text.matchAll(jsPattern)) {
        jsHits.push({ file, index: src.offset + m.index! + 1, length: fromText.length, quote: m[1] });
      }
    }
  }
  if (jsHits.length !== 1) return { ok: false, reason: jsHits.length > 1 ? "ambiguous" : "not-found" };
  const hit = jsHits[0];
  const safe = toText.replace(new RegExp(hit.quote === "`" ? "`" : hit.quote, "g"), `\\${hit.quote}`);
  const content = files[hit.file];
  return {
    ok: true,
    file: hit.file,
    files: { ...files, [hit.file]: content.slice(0, hit.index) + safe + content.slice(hit.index + hit.length) },
  };
}
