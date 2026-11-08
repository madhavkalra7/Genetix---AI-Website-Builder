"use client";

// Preview for PUBLIC share pages. Unlike <HTMLPreview> (which writes into a same-origin iframe so
// the owner's own sites can use localStorage), this renders the untrusted, third-party project in an
// opaque-origin sandbox (no allow-same-origin): its scripts can't read the visitor's cookies or call
// the Genetix API as them. Web Storage is replaced by an in-memory shim so games/apps keep working.

import { useEffect, useMemo, useRef, useState } from "react";
import { buildStaticHtml, iframeNavigationScript, listHtmlPages, type StaticFiles } from "@/lib/static-html";

const STORAGE_SHIM = `<script data-genetix-storage>(function(){function mk(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
["localStorage","sessionStorage"].forEach(function(n){var ok=false;try{ok=!!window[n]}catch(e){}if(!ok){try{Object.defineProperty(window,n,{value:mk(),configurable:true})}catch(e){}}});})();</script>`;

function insertAtHeadStart(html: string, snippet: string): string {
    const match = /<head[^>]*>/i.exec(html);
    if (match) return html.slice(0, match.index + match[0].length) + snippet + html.slice(match.index + match[0].length);
    return snippet + html;
}

function insertBeforeBodyEnd(html: string, snippet: string): string {
    const i = html.toLowerCase().lastIndexOf("</body>");
    return i === -1 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
}

interface SandboxedPreviewProps {
    files: StaticFiles;
    className?: string;
    title?: string;
}

export function SandboxedPreview({ files, className, title = "Shared project preview" }: SandboxedPreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [page, setPage] = useState("index.html");
    const pages = useMemo(() => listHtmlPages(files), [files]);

    const srcDoc = useMemo(() => {
        const built = buildStaticHtml(files, page) ?? buildStaticHtml(files);
        if (!built) return "";
        return insertBeforeBodyEnd(insertAtHeadStart(built, STORAGE_SHIM), iframeNavigationScript(pages));
    }, [files, page, pages]);

    // Multi-page sites: the injected script asks us to render another .html page.
    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            const data = event.data as { type?: unknown; page?: unknown } | null;
            if (data?.type === "genetix-navigate" && typeof data.page === "string" && pages.includes(data.page)) {
                setPage(data.page);
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [pages]);

    return (
        <iframe
            ref={iframeRef}
            title={title}
            srcDoc={srcDoc}
            className={className}
            // Deliberately NO allow-same-origin (see note at the top of this file).
            sandbox="allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads"
            allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%" }}
        />
    );
}
