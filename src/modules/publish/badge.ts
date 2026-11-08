/**
 * "Made with Genetix" badge injected into published HTML pages.
 * Pure (no server-only imports) so it can be unit tested.
 *
 * Uses a declarative shadow root (<template shadowrootmode>), so it needs no JavaScript and
 * the page's CSS can't restyle it (nor can the badge's CSS leak into the page). The host
 * element's positioning is inline + !important, which beats any author stylesheet.
 */

const escapeAttr = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildBadgeUrl(appBaseUrl: string, slug: string): string {
    const base = appBaseUrl.replace(/\/+$/, "");
    return `${base}/?ref=badge&site=${encodeURIComponent(slug)}`;
}

export function badgeHtml(appBaseUrl: string, slug: string): string {
    const href = escapeAttr(buildBadgeUrl(appBaseUrl, slug));
    return (
        `<genetix-badge style="all:initial!important;position:fixed!important;right:12px!important;bottom:12px!important;` +
        `z-index:2147483000!important;display:block!important">` +
        `<template shadowrootmode="open"><style>` +
        `a{all:initial;display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;` +
        `background:rgba(15,15,20,.82);border:1px solid rgba(255,255,255,.16);-webkit-backdrop-filter:blur(8px);` +
        `backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.25);color:#f4f4f5;` +
        `font:500 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;` +
        `transition:transform .15s,background-color .15s}` +
        `a:hover{background:rgba(15,15,20,.95);transform:translateY(-1px)}` +
        `a:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}svg{width:12px;height:12px}b{font-weight:700}` +
        `@media (prefers-reduced-motion:reduce){a{transition:none}a:hover{transform:none}}` +
        `@media print{a{display:none}}</style>` +
        `<a href="${href}" target="_top" rel="noopener" aria-label="Made with Genetix">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#facc15" d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>` +
        `Made with <b>Genetix</b></a></template></genetix-badge>`
    );
}

/** Inserts `snippet` before the last </body> (or appends it when there is none). */
export function insertBeforeBodyEnd(html: string, snippet: string): string {
    const idx = html.toLowerCase().lastIndexOf("</body");
    if (idx === -1) return html + snippet;
    return html.slice(0, idx) + snippet + html.slice(idx);
}
