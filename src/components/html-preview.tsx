"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildStaticHtml, findHtml, iframeNavigationScript, listHtmlPages } from "@/lib/static-html";

interface HTMLPreviewProps {
  files: { [path: string]: string };
  className?: string;
}

export function HTMLPreview({ files, className }: HTMLPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState<string>("index.html");

  const pages = useMemo(() => listHtmlPages(files), [files]);

  // Reset to the home page when a new version of the project arrives
  useEffect(() => {
    setCurrentPage("index.html");
  }, [files]);

  // Listen for navigation requests from the iframe (links to the project's own .html pages)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "genetix-navigate" && typeof event.data.page === "string") {
        setCurrentPage(event.data.page);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const built = buildStaticHtml(files, currentPage);
    if (!built) return;

    const lower = built.toLowerCase();
    const i = lower.lastIndexOf("</body>");
    const nav = iframeNavigationScript(pages);
    const html = i === -1 ? built + nav : built.slice(0, i) + nav + built.slice(i);

    // document.write (instead of srcdoc) keeps the iframe same-origin so generated
    // sites can use localStorage/sessionStorage without throwing.
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.scrollTo(0, 0);
  }, [files, currentPage, pages]);

  if (!findHtml(files)) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ""}`}>
        <p className="text-muted-foreground text-sm">No HTML file found for preview</p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className={`border-0 ${className ?? ""}`}
      title="HTML Preview"
      // allow-popups: external target="_blank" links open in a new tab.
      // allow-pointer-lock + fullscreen: first-person / 3D games lock the mouse on "Start";
      // without these the click silently fails and the game looks broken.
      // (No allow-forms: a plain form submit would load the Genetix app inside the preview.)
      sandbox="allow-scripts allow-same-origin allow-modals allow-popups allow-pointer-lock allow-downloads"
      allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; clipboard-write"
      allowFullScreen
      style={{ width: "100%", height: "100%" }}
    />
  );
}
