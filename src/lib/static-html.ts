// Builds a single self-contained HTML document from a static project's files
// (index.html + css + js + data-URL images). Shared by the inline preview iframe
// and the "Open in full screen" tab so both always render identically.

export type StaticFiles = Record<string, string>;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "/home/user/about.html", "./about.html", "/about.html" -> "about.html" */
export const normalizePath = (p: string) => p.replace(/^\.?\/+/, "").replace(/^home\/user\//, "");

const baseName = (p: string) => p.split("/").pop() || p;

export function findHtml(files: StaticFiles, page = "index.html"): string | undefined {
  const clean = normalizePath(page);
  return (
    files[clean] ??
    files[`/home/user/${clean}`] ??
    files[`/${clean}`] ??
    files["index.html"] ??
    files["/home/user/index.html"] ??
    files["/index.html"]
  );
}

export const hasStaticEntry = (files: unknown): files is StaticFiles =>
  !!files &&
  typeof files === "object" &&
  ["index.html", "/home/user/index.html", "/index.html"].some((k) => typeof (files as StaticFiles)[k] === "string");

export const listHtmlPages = (files: StaticFiles): string[] =>
  Array.from(new Set(Object.keys(files).filter((f) => f.endsWith(".html")).map(normalizePath)));

/** Insert `snippet` right before the LAST occurrence of `tag` (or append). Never uses `$` replacement patterns. */
function insertBeforeLast(html: string, tag: string, snippet: string): string {
  const i = html.toLowerCase().lastIndexOf(tag);
  return i === -1 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
}

/** Insert into <head> (creating one if needed). */
function insertIntoHead(html: string, snippet: string): string {
  const lower = html.toLowerCase();
  const close = lower.indexOf("</head>");
  if (close !== -1) return html.slice(0, close) + snippet + html.slice(close);
  const open = lower.match(/<head[^>]*>/);
  if (open?.index !== undefined) {
    const end = open.index + open[0].length;
    return html.slice(0, end) + snippet + html.slice(end);
  }
  const htmlTag = lower.match(/<html[^>]*>/);
  if (htmlTag?.index !== undefined) {
    const end = htmlTag.index + htmlTag[0].length;
    return html.slice(0, end) + `<head>${snippet}</head>` + html.slice(end);
  }
  return snippet + html;
}

/** Inline JS must not contain a literal "</script" or it would terminate the tag early. */
const safeInlineScript = (js: string) => js.replace(/<\/script/gi, "<\\/script");

// Only hide scrollbars visually. Do NOT force overflow on html/body: that breaks
// position:sticky headers and modal/menu scroll-locking in generated sites.
const SCROLLBAR_STYLE = `<style data-genetix>
*::-webkit-scrollbar{display:none!important}
html{-ms-overflow-style:none;scrollbar-width:none;overflow-x:hidden}
</style>`;

export function buildStaticHtml(files: StaticFiles, page = "index.html"): string | null {
  let html = findHtml(files, page);
  if (!html) return null;

  const names = Object.keys(files);

  // 1) Images stored as data URLs -> replace src="img.png" / "./img.png" / "/home/user/img.png" and CSS url(img.png)
  const imageFiles = names.filter((f) => /\.(jpe?g|png|gif|svg|webp|avif)$/i.test(f) && files[f]?.startsWith("data:"));
  const replaceImageRefs = (text: string) => {
    for (const img of imageFiles) {
      const name = escapeRegExp(baseName(img));
      const pathPrefix = `(?:\\.?\\/)?(?:home\\/user\\/)?(?:[\\w-]+\\/)*`;
      const dataUrl = files[img];
      text = text
        .replace(new RegExp(`(src=["'])\\s*${pathPrefix}${name}(["'])`, "gi"), (_m, a, b) => a + dataUrl + b)
        .replace(new RegExp(`(url\\(\\s*["']?)${pathPrefix}${name}(["']?\\s*\\))`, "gi"), (_m, a, b) => a + dataUrl + b);
    }
    return text;
  };
  html = replaceImageRefs(html);

  // 2) CSS: replace the matching <link> tag in place (keeps cascade order), else inject into <head>
  for (const cssFile of names.filter((f) => f.endsWith(".css") && files[f])) {
    const css = replaceImageRefs(files[cssFile]);
    const style = `<style data-file="${baseName(cssFile)}">\n${css}\n</style>`;
    const linkRe = new RegExp(`<link\\b[^>]*href=["'][^"']*${escapeRegExp(baseName(cssFile))}["'][^>]*>`, "i");
    html = linkRe.test(html) ? html.replace(linkRe, () => style) : insertIntoHead(html, style);
  }

  // 3) JS: drop the external <script src> tag (it would 404) and inline the code at the end of <body>
  for (const jsFile of names.filter((f) => f.endsWith(".js") && files[f])) {
    const scriptRe = new RegExp(
      `<script\\b([^>]*)src=["'][^"']*${escapeRegExp(baseName(jsFile))}["']([^>]*)>\\s*</script>`,
      "i"
    );
    let isModule = false;
    html = html.replace(scriptRe, (_m, a: string, b: string) => {
      isModule = /type=["']module["']/i.test(a + b);
      return "";
    });
    const script = `<script${isModule ? ' type="module"' : ""} data-file="${baseName(jsFile)}">\n${safeInlineScript(files[jsFile])}\n</script>`;
    html = insertBeforeLast(html, "</body>", script);
  }

  return insertIntoHead(html, SCROLLBAR_STYLE);
}

/**
 * Script for the inline preview iframe: intercepts clicks on links to the project's
 * own .html pages and asks the parent (HTMLPreview) to render that page.
 */
export function iframeNavigationScript(pages: string[]): string {
  return `<script data-genetix>(function(){var pages=${JSON.stringify(pages).replace(/</g, "\\u003c")};
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;
var href=a.getAttribute('href')||'';if(/^(https?:|mailto:|tel:|#|javascript:)/i.test(href))return;
var name=href.split('#')[0].split('?')[0].replace(/^\\.?\\/+/,'').split('/').pop();
if(name&&pages.indexOf(name)!==-1){e.preventDefault();window.parent.postMessage({type:'genetix-navigate',page:name},'*');}},true);})();</script>`;
}

/**
 * Full standalone document for the "Open in full screen" tab. All pages are embedded so
 * links between pages (about.html, contact.html, ...) keep working without a server.
 */
export function buildStandaloneHtml(files: StaticFiles): string | null {
  const pages: Record<string, string> = {};
  for (const p of listHtmlPages(files)) {
    const built = buildStaticHtml(files, p);
    if (built) pages[p] = built;
  }
  const entry = buildStaticHtml(files, "index.html");
  if (!entry) return null;

  // Re-injects itself into every page it renders so navigation keeps working.
  const boot = function (PAGES: Record<string, string>) {
    const bootSrc = "(" + (window as unknown as { __gxBoot: string }).__gxBoot + ")";
    document.addEventListener(
      "click",
      (e) => {
        const a = (e.target as Element | null)?.closest?.("a[href]");
        if (!a) return;
        const href = a.getAttribute("href") || "";
        if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return;
        const name = href.split("#")[0].split("?")[0].replace(/^\.?\/+/, "").split("/").pop() || "";
        const target = PAGES[name];
        if (!target) return;
        e.preventDefault();
        const payload = JSON.stringify(PAGES).replace(/</g, "\\u003c");
        const tag = "<scr" + "ipt>window.__gxBoot=" + JSON.stringify(bootSrc.slice(1, -1)).replace(/</g, "\\u003c") +
          ";" + bootSrc + "(" + payload + ")</scr" + "ipt>";
        const lower = target.toLowerCase();
        const i = lower.lastIndexOf("</body>");
        document.open();
        document.write(i === -1 ? target + tag : target.slice(0, i) + tag + target.slice(i));
        document.close();
        window.scrollTo(0, 0);
      },
      true
    );
  };
  const bootSrc = boot.toString();
  const tag =
    `<script data-genetix>window.__gxBoot=${JSON.stringify(bootSrc).replace(/</g, "\\u003c")};` +
    `(${bootSrc})(${JSON.stringify(pages).replace(/</g, "\\u003c")})</script>`;
  return insertBeforeLast(entry, "</body>", tag);
}
