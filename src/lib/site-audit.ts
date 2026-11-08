// SEO + accessibility audit for static projects (index.html + css + js).
// Pure and dependency-free: HTML is read with a small, tolerant regex-based scanner,
// so it runs both in the browser (audit panel) and in tests.

import { normalizePath } from "@/lib/static-html";

export type AuditCategory = "seo" | "accessibility" | "performance" | "best-practices";
export type AuditStatus = "pass" | "warn" | "fail";

export interface AuditCheck {
  id: string;
  category: AuditCategory;
  status: AuditStatus;
  title: string;
  detail: string;
  fixHint: string;
}

export interface AuditResult {
  /** Weighted overall score, 0-100 */
  score: number;
  /** Weighted score per category, 0-100 */
  categoryScores: Record<AuditCategory, number>;
  checks: AuditCheck[];
}

export const AUDIT_CATEGORIES: AuditCategory[] = ["seo", "accessibility", "performance", "best-practices"];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  seo: "SEO",
  accessibility: "Accessibility",
  performance: "Performance",
  "best-practices": "Best practices",
};

// Relative importance of each check in the overall score
const WEIGHTS: Record<string, number> = {
  title: 3,
  "meta-description": 3,
  viewport: 3,
  lang: 2,
  h1: 2,
  "heading-order": 1,
  "img-alt": 3,
  "link-names": 2,
  "button-names": 2,
  "form-labels": 2,
  "open-graph": 1,
  favicon: 1,
  canonical: 0.5,
  "inline-handlers": 0.5,
  "large-inline-images": 1,
  "render-blocking-scripts": 1,
  "blank-noopener": 1,
  "theme-color": 0.5,
};

const STATUS_VALUE: Record<AuditStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

const LARGE_INLINE_IMAGE_BYTES = 300 * 1024;

// ---------------------------------------------------------------------------
// Tiny tolerant HTML helpers
// ---------------------------------------------------------------------------

export type Attrs = Record<string, string>;

/** Parse the attribute part of a start tag: `a="1" b='2' c=3 d` -> {a:"1",b:"2",c:"3",d:""} */
export function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

interface Tag {
  name: string;
  attrs: Attrs;
  index: number;
}

/** Blank out comments and the bodies of <script>/<style>/<template> (keeps offsets stable). */
function stripNonMarkup(html: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style|template)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (_m, open, _n, body, close) => open + blank(body) + close);
}

function findTags(html: string, name: string): Tag[] {
  const out: Tag[] = [];
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ name: name.toLowerCase(), attrs: parseAttrs(m[1]), index: m.index });
  return out;
}

/** Elements with content: [{attrs, inner, index}] (non-nested elements like <a>, <button>, <label>, <hN>) */
function findElements(html: string, name: string): { attrs: Attrs; inner: string; index: number; end: number }[] {
  const out: { attrs: Attrs; inner: string; index: number; end: number }[] = [];
  const re = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({ attrs: parseAttrs(m[1]), inner: m[2], index: m.index, end: m.index + m[0].length });
  }
  return out;
}

const textOf = (inner: string) =>
  inner
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Accessible name from content, aria-label, title or an inner image's alt */
function hasAccessibleName(attrs: Attrs, inner: string): boolean {
  if ((attrs["aria-label"] ?? "").trim() || (attrs["aria-labelledby"] ?? "").trim() || (attrs.title ?? "").trim()) {
    return true;
  }
  if (textOf(inner)) return true;
  for (const img of findTags(inner, "img")) if ((img.attrs.alt ?? "").trim()) return true;
  for (const svg of findElements(inner, "svg")) {
    if ((svg.attrs["aria-label"] ?? "").trim() || /<title\b[^>]*>\s*\S/i.test(svg.inner)) return true;
  }
  return false;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const examples = (items: string[], max = 3) => {
  const shown = items.slice(0, max).map((s) => (s.length > 60 ? s.slice(0, 59) + "…" : s));
  return shown.length ? ` (e.g. ${shown.join(", ")}${items.length > max ? ", …" : ""})` : "";
};

const describeTag = (name: string, attrs: Attrs) => {
  if (attrs.id) return `${name}#${attrs.id}`;
  if (attrs.src) return `${name}[src="${attrs.src.startsWith("data:") ? "data:…" : attrs.src}"]`;
  if (attrs.href) return `${name}[href="${attrs.href}"]`;
  if (attrs.name) return `${name}[name="${attrs.name}"]`;
  const cls = (attrs.class ?? "").trim().split(/\s+/)[0];
  return cls ? `${name}.${cls}` : name;
};

function decodedBytes(base64Length: number) {
  return Math.floor((base64Length * 3) / 4);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function auditSite(files: Record<string, string>): AuditResult {
  const normalized: Record<string, string> = {};
  for (const [path, content] of Object.entries(files ?? {})) {
    if (typeof content === "string") normalized[normalizePath(path)] = content;
  }

  const htmlPaths = Object.keys(normalized).filter((p) => /\.html?$/i.test(p));
  const indexPath = htmlPaths.find((p) => p === "index.html") ?? htmlPaths[0];
  const rawIndex = indexPath ? normalized[indexPath] : "";
  const index = stripNonMarkup(rawIndex);
  const pages = htmlPaths.map((p) => ({ path: p, html: stripNonMarkup(normalized[p]) }));

  const checks: AuditCheck[] = [];
  const add = (c: AuditCheck) => checks.push(c);

  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(index);
  const head = headMatch ? headMatch[1] : index;
  const metas = findTags(head, "meta");
  const links = findTags(head, "link");
  const metaByName = (name: string) =>
    metas.find((m) => (m.attrs.name ?? "").toLowerCase() === name || (m.attrs.property ?? "").toLowerCase() === name);
  const relHas = (attrs: Attrs, rel: string) => (attrs.rel ?? "").toLowerCase().split(/\s+/).includes(rel);

  // --- SEO --------------------------------------------------------------
  const titleEl = findElements(index, "title")[0];
  const title = titleEl ? textOf(titleEl.inner) : "";
  if (!title) {
    add({
      id: "title",
      category: "seo",
      status: "fail",
      title: "Page title",
      detail: "The page has no <title>.",
      fixHint: "Add a descriptive <title> of 10-60 characters inside <head>.",
    });
  } else if (title.length < 10 || title.length > 60) {
    add({
      id: "title",
      category: "seo",
      status: "warn",
      title: "Page title",
      detail: `The title is ${title.length} characters ("${title.slice(0, 70)}"); 10-60 is ideal.`,
      fixHint: "Rewrite the <title> to be 10-60 characters and describe the page.",
    });
  } else {
    add({ id: "title", category: "seo", status: "pass", title: "Page title", detail: `"${title}"`, fixHint: "" });
  }

  const description = (metaByName("description")?.attrs.content ?? "").trim();
  if (!description) {
    add({
      id: "meta-description",
      category: "seo",
      status: "fail",
      title: "Meta description",
      detail: "No <meta name=\"description\"> found.",
      fixHint: "Add a <meta name=\"description\"> of 50-160 characters summarising the page.",
    });
  } else if (description.length < 50 || description.length > 160) {
    add({
      id: "meta-description",
      category: "seo",
      status: "warn",
      title: "Meta description",
      detail: `The description is ${description.length} characters; 50-160 is ideal.`,
      fixHint: "Rewrite the meta description to be 50-160 characters.",
    });
  } else {
    add({ id: "meta-description", category: "seo", status: "pass", title: "Meta description", detail: `${description.length} characters`, fixHint: "" });
  }

  const viewport = metaByName("viewport");
  add(
    viewport && /width\s*=\s*device-width/i.test(viewport.attrs.content ?? "")
      ? { id: "viewport", category: "seo", status: "pass", title: "Mobile viewport", detail: "Viewport meta tag is set.", fixHint: "" }
      : {
          id: "viewport",
          category: "seo",
          status: "fail",
          title: "Mobile viewport",
          detail: viewport ? "The viewport meta tag lacks width=device-width." : "No viewport meta tag; the page won't scale on phones.",
          fixHint: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.',
        },
  );

  const ogMissing = ["og:title", "og:description", "og:image"].filter((p) => !(metaByName(p)?.attrs.content ?? "").trim());
  add(
    ogMissing.length === 0
      ? { id: "open-graph", category: "seo", status: "pass", title: "Social sharing (Open Graph)", detail: "og:title, og:description and og:image are set.", fixHint: "" }
      : {
          id: "open-graph",
          category: "seo",
          status: ogMissing.length === 3 ? "fail" : "warn",
          title: "Social sharing (Open Graph)",
          detail: `Missing ${ogMissing.join(", ")}.`,
          fixHint: `Add <meta property="..."> tags for ${ogMissing.join(", ")} so links look good when shared.`,
        },
  );

  const favicon = links.some((l) => relHas(l.attrs, "icon") || relHas(l.attrs, "apple-touch-icon"));
  add(
    favicon
      ? { id: "favicon", category: "seo", status: "pass", title: "Favicon", detail: "A favicon link is present.", fixHint: "" }
      : {
          id: "favicon",
          category: "seo",
          status: "warn",
          title: "Favicon",
          detail: "No <link rel=\"icon\"> found.",
          fixHint: 'Add a favicon, e.g. <link rel="icon" href="data:image/svg+xml,..."> with an inline SVG emoji or logo.',
        },
  );

  const canonical = links.some((l) => relHas(l.attrs, "canonical") && (l.attrs.href ?? "").trim());
  add(
    canonical
      ? { id: "canonical", category: "seo", status: "pass", title: "Canonical URL", detail: "A canonical link is present.", fixHint: "" }
      : {
          id: "canonical",
          category: "seo",
          status: "warn",
          title: "Canonical URL",
          detail: "No <link rel=\"canonical\"> (optional, helps avoid duplicate-content issues once published).",
          fixHint: 'Add <link rel="canonical" href="https://your-domain/"> once the final URL is known.',
        },
  );

  // --- Accessibility ----------------------------------------------------
  const htmlTag = findTags(index, "html")[0];
  add(
    htmlTag && (htmlTag.attrs.lang ?? "").trim()
      ? { id: "lang", category: "accessibility", status: "pass", title: "Page language", detail: `lang="${htmlTag.attrs.lang}"`, fixHint: "" }
      : {
          id: "lang",
          category: "accessibility",
          status: "fail",
          title: "Page language",
          detail: "The <html> element has no lang attribute; screen readers may mispronounce the content.",
          fixHint: 'Add a lang attribute to <html>, e.g. <html lang="en">.',
        },
  );

  const h1Count = findTags(index, "h1").length;
  add(
    h1Count === 1
      ? { id: "h1", category: "accessibility", status: "pass", title: "One main heading", detail: "Exactly one <h1>.", fixHint: "" }
      : {
          id: "h1",
          category: "accessibility",
          status: h1Count === 0 ? "fail" : "warn",
          title: "One main heading",
          detail: h1Count === 0 ? "The page has no <h1>." : `The page has ${h1Count} <h1> elements.`,
          fixHint: h1Count === 0 ? "Add a single <h1> describing the page's main topic." : "Keep exactly one <h1>; turn the others into <h2>.",
        },
  );

  const headingLevels: number[] = [];
  {
    const re = /<h([1-6])\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(index))) headingLevels.push(Number(m[1]));
  }
  const skips: string[] = [];
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) skips.push(`h${headingLevels[i - 1]} → h${headingLevels[i]}`);
  }
  add(
    skips.length === 0
      ? { id: "heading-order", category: "accessibility", status: "pass", title: "Heading order", detail: "Headings don't skip levels.", fixHint: "" }
      : {
          id: "heading-order",
          category: "accessibility",
          status: "warn",
          title: "Heading order",
          detail: `Headings skip levels${examples(Array.from(new Set(skips)))}.`,
          fixHint: "Use heading levels in order (h1 → h2 → h3) without skipping; restyle with CSS instead of picking a smaller heading.",
        },
  );

  const imgsNoAlt: string[] = [];
  let imgCount = 0;
  for (const page of pages) {
    for (const img of findTags(page.html, "img")) {
      imgCount++;
      if (!("alt" in img.attrs)) imgsNoAlt.push(describeTag("img", img.attrs));
    }
  }
  add(
    imgsNoAlt.length === 0
      ? { id: "img-alt", category: "accessibility", status: "pass", title: "Image alt text", detail: imgCount ? `All ${plural(imgCount, "image")} have alt text.` : "No images found.", fixHint: "" }
      : {
          id: "img-alt",
          category: "accessibility",
          status: "fail",
          title: "Image alt text",
          detail: `${plural(imgsNoAlt.length, "image")} without an alt attribute${examples(imgsNoAlt)}.`,
          fixHint: 'Add descriptive alt text to every <img> (use alt="" for purely decorative images).',
        },
  );

  const unnamedLinks: string[] = [];
  const unnamedButtons: string[] = [];
  for (const page of pages) {
    for (const a of findElements(page.html, "a")) {
      if (!hasAccessibleName(a.attrs, a.inner)) unnamedLinks.push(describeTag("a", a.attrs));
    }
    for (const b of findElements(page.html, "button")) {
      if (!hasAccessibleName(b.attrs, b.inner)) unnamedButtons.push(describeTag("button", b.attrs));
    }
    for (const input of findTags(page.html, "input")) {
      const type = (input.attrs.type ?? "").toLowerCase();
      if ((type === "submit" || type === "button" || type === "reset") && !(input.attrs.value ?? "").trim() && !(input.attrs["aria-label"] ?? "").trim()) {
        // submit/reset have a default label; only bare type=button is nameless
        if (type === "button") unnamedButtons.push(describeTag("input", input.attrs));
      }
    }
  }
  add(
    unnamedLinks.length === 0
      ? { id: "link-names", category: "accessibility", status: "pass", title: "Link names", detail: "Every link has discernible text.", fixHint: "" }
      : {
          id: "link-names",
          category: "accessibility",
          status: "fail",
          title: "Link names",
          detail: `${plural(unnamedLinks.length, "link")} without text or aria-label${examples(unnamedLinks)}.`,
          fixHint: "Give icon-only links an aria-label (e.g. aria-label=\"Instagram\") or visible text.",
        },
  );
  add(
    unnamedButtons.length === 0
      ? { id: "button-names", category: "accessibility", status: "pass", title: "Button names", detail: "Every button has an accessible name.", fixHint: "" }
      : {
          id: "button-names",
          category: "accessibility",
          status: "fail",
          title: "Button names",
          detail: `${plural(unnamedButtons.length, "button")} without text or aria-label${examples(unnamedButtons)}.`,
          fixHint: "Give icon-only buttons an aria-label describing the action (e.g. aria-label=\"Open menu\").",
        },
  );

  const unlabelled: string[] = [];
  let fieldCount = 0;
  for (const page of pages) {
    const labels = findElements(page.html, "label");
    const labelFor = new Set(labels.map((l) => (l.attrs.for ?? "").trim()).filter(Boolean));
    const fields = [
      ...findTags(page.html, "input"),
      ...findTags(page.html, "select"),
      ...findTags(page.html, "textarea"),
    ];
    for (const f of fields) {
      const type = (f.attrs.type ?? "").toLowerCase();
      if (f.name === "input" && ["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      fieldCount++;
      const named =
        (f.attrs["aria-label"] ?? "").trim() ||
        (f.attrs["aria-labelledby"] ?? "").trim() ||
        (f.attrs.title ?? "").trim() ||
        (f.attrs.id && labelFor.has(f.attrs.id)) ||
        labels.some((l) => f.index > l.index && f.index < l.end);
      if (!named) unlabelled.push(describeTag(f.name, f.attrs));
    }
  }
  add(
    unlabelled.length === 0
      ? { id: "form-labels", category: "accessibility", status: "pass", title: "Form labels", detail: fieldCount ? `All ${plural(fieldCount, "form field")} are labelled.` : "No form fields found.", fixHint: "" }
      : {
          id: "form-labels",
          category: "accessibility",
          status: "fail",
          title: "Form labels",
          detail: `${plural(unlabelled.length, "form field")} without a label${examples(unlabelled)}. Placeholders are not labels.`,
          fixHint: 'Add a <label for="id"> for each field (visually hidden if needed) or an aria-label.',
        },
  );

  // --- Performance ------------------------------------------------------
  const largeImages: string[] = [];
  for (const [path, content] of Object.entries(normalized)) {
    if (/^data:image\//i.test(content.slice(0, 20))) {
      const comma = content.indexOf(",");
      if (decodedBytes(content.length - comma - 1) > LARGE_INLINE_IMAGE_BYTES) largeImages.push(path);
      continue;
    }
    const re = /data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      if (decodedBytes(m[1].length) > LARGE_INLINE_IMAGE_BYTES) largeImages.push(`${path} (inline data: image)`);
    }
  }
  add(
    largeImages.length === 0
      ? { id: "large-inline-images", category: "performance", status: "pass", title: "Image weight", detail: "No embedded image is larger than 300 KB.", fixHint: "" }
      : {
          id: "large-inline-images",
          category: "performance",
          status: "warn",
          title: "Image weight",
          detail: `${plural(largeImages.length, "embedded image")} over 300 KB${examples(largeImages)}.`,
          fixHint: "Use smaller/compressed images (WebP, max ~1600px wide) and loading=\"lazy\" below the fold.",
        },
  );

  const blocking: string[] = [];
  for (const s of findTags(head, "script")) {
    const type = (s.attrs.type ?? "").toLowerCase();
    if (s.attrs.src && !("defer" in s.attrs) && !("async" in s.attrs) && type !== "module") blocking.push(s.attrs.src);
  }
  add(
    blocking.length === 0
      ? { id: "render-blocking-scripts", category: "performance", status: "pass", title: "Render-blocking scripts", detail: "No blocking scripts in <head>.", fixHint: "" }
      : {
          id: "render-blocking-scripts",
          category: "performance",
          status: "warn",
          title: "Render-blocking scripts",
          detail: `${plural(blocking.length, "script")} in <head> without defer/async${examples(blocking)}.`,
          fixHint: "Add defer to <script src> tags in <head> (or move them to the end of <body>).",
        },
  );

  // --- Best practices ---------------------------------------------------
  let inlineHandlers = 0;
  for (const page of pages) {
    const re = /<[a-z][\w-]*\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(page.html))) {
      const attrs = parseAttrs(m[0].replace(/^<[a-z][\w-]*/i, "").replace(/\/?>$/, ""));
      inlineHandlers += Object.keys(attrs).filter((k) => /^on[a-z]+$/.test(k)).length;
    }
  }
  add(
    inlineHandlers === 0
      ? { id: "inline-handlers", category: "best-practices", status: "pass", title: "Inline event handlers", detail: "No onclick=\"…\"-style handlers.", fixHint: "" }
      : {
          id: "inline-handlers",
          category: "best-practices",
          status: "warn",
          title: "Inline event handlers",
          detail: `${plural(inlineHandlers, "inline event handler")} (onclick=, onload=, …).`,
          fixHint: "Move inline on*= handlers into the JavaScript file using addEventListener.",
        },
  );

  const unsafeBlank: string[] = [];
  for (const page of pages) {
    for (const a of findTags(page.html, "a")) {
      if ((a.attrs.target ?? "").toLowerCase() !== "_blank") continue;
      const rel = (a.attrs.rel ?? "").toLowerCase().split(/\s+/);
      if (!rel.includes("noopener") && !rel.includes("noreferrer")) unsafeBlank.push(describeTag("a", a.attrs));
    }
  }
  add(
    unsafeBlank.length === 0
      ? { id: "blank-noopener", category: "best-practices", status: "pass", title: "Safe external links", detail: "Links opening new tabs use rel=\"noopener\".", fixHint: "" }
      : {
          id: "blank-noopener",
          category: "best-practices",
          status: "warn",
          title: "Safe external links",
          detail: `${plural(unsafeBlank.length, "link")} with target="_blank" but no rel="noopener"${examples(unsafeBlank)}.`,
          fixHint: 'Add rel="noopener noreferrer" to every link with target="_blank".',
        },
  );

  const themeColor = !!metaByName("theme-color") || !!metaByName("color-scheme");
  add(
    themeColor
      ? { id: "theme-color", category: "best-practices", status: "pass", title: "Theme colour", detail: "theme-color / color-scheme meta is set.", fixHint: "" }
      : {
          id: "theme-color",
          category: "best-practices",
          status: "warn",
          title: "Theme colour",
          detail: "No theme-color or color-scheme meta tag (colours the mobile browser UI).",
          fixHint: 'Add <meta name="theme-color" content="#yourbrandcolor"> (and color-scheme if the site has a dark mode).',
        },
  );

  if (!indexPath) {
    // Nothing to audit: report a single failure instead of a misleading score
    return {
      score: 0,
      categoryScores: { seo: 0, accessibility: 0, performance: 0, "best-practices": 0 },
      checks: [
        {
          id: "no-html",
          category: "seo",
          status: "fail",
          title: "No HTML page",
          detail: "This project has no HTML page to audit.",
          fixHint: "Add an index.html.",
        },
      ],
    };
  }

  return { score: weightedScore(checks), categoryScores: categoryScores(checks), checks };
}

function weightedScore(checks: AuditCheck[]): number {
  let total = 0;
  let earned = 0;
  for (const c of checks) {
    const w = WEIGHTS[c.id] ?? 1;
    total += w;
    earned += w * STATUS_VALUE[c.status];
  }
  return total === 0 ? 100 : Math.round((earned / total) * 100);
}

function categoryScores(checks: AuditCheck[]): Record<AuditCategory, number> {
  const out = {} as Record<AuditCategory, number>;
  for (const cat of AUDIT_CATEGORIES) out[cat] = weightedScore(checks.filter((c) => c.category === cat));
  return out;
}

/** One quick-edit request that fixes every failing/warning check without touching the design. */
export function buildAuditFixRequest(checks: AuditCheck[]): string {
  const todo = checks.filter((c) => c.status !== "pass" && c.fixHint);
  if (!todo.length) return "";
  const lines = todo.map((c, i) => `${i + 1}) ${c.title}: ${c.fixHint} (${c.detail})`);
  // Chat messages are capped at 10k characters
  return `Improve SEO & accessibility without changing the design, layout, colours or copy. Fix these audit findings:\n${lines.join("\n")}`.slice(0, 9000);
}
