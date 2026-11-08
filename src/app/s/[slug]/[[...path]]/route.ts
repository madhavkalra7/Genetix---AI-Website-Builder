import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDedicatedPublishOrigin } from "@/modules/publish/server/utils";

// Public hosting for published static sites: /s/<slug>/<path>
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

// Gives the page an opaque origin: no access to the app's cookies, storage or same-origin APIs.
const SANDBOX_CSP =
    "sandbox allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads";

const MIME_TYPES: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    ico: "image/x-icon",
    avif: "image/avif",
    txt: "text/plain; charset=utf-8",
    md: "text/plain; charset=utf-8",
    xml: "application/xml; charset=utf-8",
    webmanifest: "application/manifest+json; charset=utf-8",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
};

// Types that browsers may execute as a document if opened directly
const isDocumentType = (type: string) =>
    /^(text\/html|image\/svg\+xml|application\/xml|text\/xml|application\/xhtml\+xml)/i.test(type);

const typeForPath = (p: string) => {
    const ext = p.split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
    return MIME_TYPES[ext] ?? "application/octet-stream";
};

/** "/home/user/about.html", "./about.html", "/about.html" -> "about.html" */
const normalizeKey = (p: string) =>
    p.replace(/\\/g, "/").replace(/^\.?\/+/, "").replace(/^home\/user\//, "").replace(/^\.\//, "");

type Params = { slug: string; path?: string[] };

function notFound(message = "This page could not be found.") {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 - Not found</title><style>
html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0f;color:#e5e7eb;padding:24px;box-sizing:border-box}
.card{text-align:center;max-width:420px}.code{font-size:64px;font-weight:800;letter-spacing:-2px;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0}
p{color:#9ca3af;line-height:1.5}small{color:#6b7280}</style></head><body><div class="card"><p class="code">404</p><p>${message}</p><small>Published with Genetix</small></div></body></html>`;
    return new NextResponse(html, {
        status: 404,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=30",
            "Content-Security-Policy": SANDBOX_CSP,
            "X-Content-Type-Options": "nosniff",
        },
    });
}

/** Inserts `snippet` right after the opening <head> tag (creating one if needed). */
function insertAtHeadStart(html: string, snippet: string): string {
    const lower = html.toLowerCase();
    const head = lower.match(/<head(\s[^>]*)?>/);
    if (head?.index !== undefined) {
        const end = head.index + head[0].length;
        return html.slice(0, end) + snippet + html.slice(end);
    }
    const htmlTag = lower.match(/<html(\s[^>]*)?>/);
    if (htmlTag?.index !== undefined) {
        const end = htmlTag.index + htmlTag[0].length;
        return html.slice(0, end) + `<head>${snippet}</head>` + html.slice(end);
    }
    return snippet + html;
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// With <base href>, href="#x" would point at another URL; keep in-page anchors in-page.
const HASH_LINK_SCRIPT =
    `<script>document.addEventListener("click",function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;` +
    `var a=e.target&&e.target.closest&&e.target.closest("a[href^='#']");if(!a||a.target&&a.target!=="_self")return;` +
    `e.preventDefault();var h=a.getAttribute("href");if(h==="#"){window.scrollTo(0,0);return;}location.hash=h.slice(1);});</script>`;

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
    const { slug, path = [] } = await params;
    const url = request.nextUrl;

    // Is this request arriving on the dedicated publishing origin (PUBLISH_BASE_URL)?
    // We never redirect to it: if that domain isn't attached to the deployment, a redirect
    // would break every link. Requests on any other host (e.g. the main app domain) are
    // served here too, but sandboxed (see SANDBOX_CSP below) so they can't touch app cookies.
    const dedicatedOrigin = getDedicatedPublishOrigin();
    const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host)
        .split(",")[0]
        .trim()
        .toLowerCase();
    const dedicated = dedicatedOrigin && requestHost === dedicatedOrigin.host.toLowerCase() ? dedicatedOrigin : null;

    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return notFound("This site does not exist.");

    // Decode each segment; reject traversal / odd segments
    let segments: string[];
    try {
        segments = path.map((s) => decodeURIComponent(s));
    } catch {
        return notFound();
    }
    if (segments.some((s) => s === ".." || s === "." || s.includes("/") || s.includes("\\") || s.includes("\0"))) {
        return notFound();
    }

    const site = await prisma.publishedSite.findUnique({
        where: { slug },
        select: { fragmentId: true },
    });
    if (!site) return notFound("This site does not exist or has been unpublished.");

    const fragment = await prisma.fragment.findUnique({
        where: { id: site.fragmentId },
        select: { files: true },
    });
    const rawFiles = fragment?.files;
    if (!rawFiles || typeof rawFiles !== "object" || Array.isArray(rawFiles)) {
        return notFound("This site is no longer available.");
    }

    // Normalized path -> content (exact "index.html" wins over "/home/user/index.html")
    const files = new Map<string, string>();
    for (const [key, value] of Object.entries(rawFiles as Record<string, unknown>)) {
        if (typeof value !== "string") continue;
        const norm = normalizeKey(key);
        if (!norm || norm.split("/").includes("..")) continue;
        if (!files.has(norm) || key === norm) files.set(norm, value);
    }

    const requested = segments.join("/");
    const endsWithSlash = url.pathname.endsWith("/");

    // Candidate resolution order
    const candidates: { key: string; isDirIndex: boolean }[] = [];
    if (!requested) {
        candidates.push({ key: "index.html", isDirIndex: true });
    } else {
        candidates.push({ key: requested, isDirIndex: false });
        if (!/\.[a-z0-9]+$/i.test(requested)) {
            candidates.push({ key: `${requested}.html`, isDirIndex: false });
        }
        candidates.push({ key: `${requested}/index.html`, isDirIndex: true });
    }

    let resolvedKey: string | null = null;
    let isDirIndex = false;
    for (const c of candidates) {
        if (files.has(c.key)) {
            resolvedKey = c.key;
            isDirIndex = c.isDirIndex;
            break;
        }
    }
    // Generated HTML sometimes references assets by bare file name (e.g. "hero.png" for "images/hero.png")
    if (!resolvedKey && requested && !requested.includes("/")) {
        const matches = [...files.keys()].filter((k) => k.split("/").pop() === requested);
        if (matches.length === 1) resolvedKey = matches[0];
    }
    if (!resolvedKey) return notFound();

    const content = files.get(resolvedKey)!;
    let contentType = typeForPath(resolvedKey);
    let body: string | Uint8Array<ArrayBuffer> = content;

    // Images (and other binaries) are stored as data: URLs
    const dataUrl = content.match(/^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,/i);
    if (dataUrl) {
        const declared = dataUrl[1]?.trim();
        const payload = content.slice(dataUrl[0].length);
        if (declared && !/^(text\/html|application\/xhtml)/i.test(declared)) contentType = declared;
        try {
            if (dataUrl[3]) {
                const buf = Buffer.from(payload, "base64");
                body = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) as Uint8Array<ArrayBuffer>;
            } else {
                body = decodeURIComponent(payload);
            }
        } catch {
            return notFound();
        }
    } else if (contentType.startsWith("text/html")) {
        // Serving a directory's index.html without a trailing slash (Next.js strips trailing
        // slashes by default): pin relative URLs ("style.css") to the directory with <base>.
        if (isDirIndex && !endsWithSlash) {
            const dir = `${url.pathname.replace(/\/+$/, "")}/`;
            body = insertAtHeadStart(content, `<base href="${escapeAttr(dir)}">${HASH_LINK_SCRIPT}`);
        }
    }

    const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    // Same origin as the app: isolate anything that can run as a document.
    if (!dedicated && isDocumentType(contentType)) {
        headers["Content-Security-Policy"] = SANDBOX_CSP;
    }

    return new NextResponse(body, { status: 200, headers });
}
