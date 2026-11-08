"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildStaticHtml, findHtml, iframeNavigationScript, listHtmlPages } from "@/lib/static-html";

export interface SelectedElementInfo {
  selector: string;
  tag: string;
  text: string;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
}

interface HTMLPreviewProps {
  files: { [path: string]: string };
  className?: string;
  /** Click-to-edit: highlight hovered elements and report the clicked one instead of activating it */
  selectMode?: boolean;
  onElementSelected?: (info: SelectedElementInfo) => void;
  /** The user pressed Escape inside the preview while selecting */
  onSelectModeExit?: () => void;
}

type SelectApi = { enable: () => void; disable: () => void };

/**
 * Element picker injected into the preview document. Re-installed on every write
 * (document.open keeps the Window object but drops its listeners). Inert until the parent calls
 * window.__genetixSelect.enable(); disable() removes every listener and the overlay.
 * Listeners sit on window in the capture phase so they run before the page's own
 * handlers (and before the navigation script's document-level click handler).
 * Plain ES5 without backslashes so it can live in a template string safely.
 */
const SELECT_SCRIPT = `<script data-genetix>(function(){
try{if(window.__genetixSelect)window.__genetixSelect.disable();}catch(e){}
var active=false,locked=null,hovered=null,overlay=null,label=null;
var MAX_DEPTH=6;
function isOurs(el){return el===overlay||el===label;}
function ensureOverlay(){
  if(overlay&&overlay.isConnected)return;
  overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #8b5cf6;background:rgba(139,92,246,0.12);border-radius:4px;box-sizing:border-box;display:none;transition:top 60ms,left 60ms,width 60ms,height 60ms;';
  label=document.createElement('div');
  label.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:#8b5cf6;color:#fff;font:600 11px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:0 6px;border-radius:4px;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis;display:none;';
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(label);
}
function classes(el){
  var c=el.getAttribute&&el.getAttribute('class');
  if(!c)return [];
  return c.split(' ').filter(function(x){return x&&x.indexOf('genetix')!==0;});
}
function describe(el){
  var s=el.tagName.toLowerCase();
  if(el.id)return s+'#'+el.id;
  var c=classes(el).slice(0,2);
  return c.length?s+'.'+c.join('.'):s;
}
function escapeIdent(v){return (window.CSS&&CSS.escape)?CSS.escape(v):null;}
function selectorFor(el){
  var parts=[],node=el,depth=0;
  while(node&&node.nodeType===1&&depth<MAX_DEPTH){
    var tag=node.tagName.toLowerCase();
    if(node.id){var id=escapeIdent(node.id);if(id){parts.unshift('#'+id);break;}}
    if(tag==='body'||tag==='html'){parts.unshift(tag);break;}
    var index=1,same=false,sib=node.previousElementSibling;
    while(sib){if(sib.tagName===node.tagName){index++;}sib=sib.previousElementSibling;}
    sib=node.nextElementSibling;
    while(sib){if(sib.tagName===node.tagName){same=true;break;}sib=sib.nextElementSibling;}
    parts.unshift(index>1||same?tag+':nth-of-type('+index+')':tag);
    node=node.parentElement;depth++;
  }
  return parts.join(' > ');
}
function pick(target){
  var el=target;
  if(el&&el.nodeType!==1)el=el.parentElement;
  if(!el||isOurs(el))return null;
  var tag=el.tagName.toLowerCase();
  if(tag==='html'||tag==='body'||tag==='script'||tag==='style')return null;
  return el;
}
function draw(el){
  ensureOverlay();
  if(!el){overlay.style.display='none';label.style.display='none';return;}
  var r=el.getBoundingClientRect();
  overlay.style.display='block';
  overlay.style.top=r.top+'px';overlay.style.left=r.left+'px';
  overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
  label.textContent=describe(el);
  label.style.display='block';
  var top=r.top-20;if(top<0)top=Math.min(r.bottom+2,window.innerHeight-20);
  label.style.top=top+'px';label.style.left=Math.max(0,r.left)+'px';
}
function onMove(e){if(!active||locked)return;var el=pick(e.target);if(el!==hovered){hovered=el;draw(el);}}
function onLeave(e){if(!active||locked)return;if(!e.relatedTarget){hovered=null;draw(null);}}
function block(e){if(!active)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}
function onClick(e){
  if(!active)return;
  block(e);
  var el=pick(e.target);if(!el)return;
  locked=el;hovered=el;draw(el);
  var r=el.getBoundingClientRect();
  var text=(el.innerText||el.textContent||'').replace(/\\s+/g,' ').trim();
  window.parent.postMessage({type:'genetix-select',selector:selectorFor(el),tag:el.tagName.toLowerCase(),
    text:text.slice(0,200),html:(el.outerHTML||'').slice(0,1500),
    rect:{x:r.left,y:r.top,width:r.width,height:r.height}},'*');
}
function onKey(e){if(!active)return;if(e.key==='Escape'){block(e);window.parent.postMessage({type:'genetix-select-cancel'},'*');}}
function onScroll(){if(active)draw(locked||hovered);}
var opts=true;
var blocked=['mousedown','mouseup','pointerdown','pointerup','dblclick','submit','contextmenu'];
window.__genetixSelect={
  enable:function(){
    if(active)return;active=true;locked=null;hovered=null;
    window.addEventListener('mousemove',onMove,opts);
    window.addEventListener('mouseout',onLeave,opts);
    window.addEventListener('click',onClick,opts);
    window.addEventListener('keydown',onKey,opts);
    window.addEventListener('scroll',onScroll,opts);
    window.addEventListener('resize',onScroll,opts);
    for(var i=0;i<blocked.length;i++)window.addEventListener(blocked[i],block,opts);
    if(document.documentElement)document.documentElement.style.cursor='crosshair';
  },
  disable:function(){
    if(!active)return;active=false;locked=null;hovered=null;
    window.removeEventListener('mousemove',onMove,opts);
    window.removeEventListener('mouseout',onLeave,opts);
    window.removeEventListener('click',onClick,opts);
    window.removeEventListener('keydown',onKey,opts);
    window.removeEventListener('scroll',onScroll,opts);
    window.removeEventListener('resize',onScroll,opts);
    for(var i=0;i<blocked.length;i++)window.removeEventListener(blocked[i],block,opts);
    if(overlay&&overlay.parentNode)overlay.parentNode.removeChild(overlay);
    if(label&&label.parentNode)label.parentNode.removeChild(label);
    overlay=null;label=null;
    if(document.documentElement)document.documentElement.style.cursor='';
  },
  clear:function(){locked=null;hovered=null;if(overlay)draw(null);}
};
})();</script>`;

export function HTMLPreview({
  files,
  className,
  selectMode = false,
  onElementSelected,
  onSelectModeExit,
}: HTMLPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState<string>("index.html");
  const selectable = !!onElementSelected;

  // Latest callbacks without re-subscribing the message listener
  const onElementSelectedRef = useRef(onElementSelected);
  const onSelectModeExitRef = useRef(onSelectModeExit);
  const selectModeRef = useRef(selectMode);
  useEffect(() => {
    onElementSelectedRef.current = onElementSelected;
    onSelectModeExitRef.current = onSelectModeExit;
    selectModeRef.current = selectMode;
  });

  const pages = useMemo(() => listHtmlPages(files), [files]);

  // Reset to the home page when a new version of the project arrives
  useEffect(() => {
    setCurrentPage("index.html");
  }, [files]);

  // Listen for messages from the iframe (navigation + element picker)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "genetix-navigate" && typeof data.page === "string") {
        setCurrentPage(data.page);
        return;
      }
      if (data.type === "genetix-select" && selectModeRef.current) {
        const rect = data.rect && typeof data.rect === "object" ? data.rect : {};
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        onElementSelectedRef.current?.({
          selector: String(data.selector ?? "").slice(0, 500),
          tag: String(data.tag ?? "").slice(0, 40),
          text: String(data.text ?? "").slice(0, 200),
          html: String(data.html ?? "").slice(0, 1500),
          rect: { x: num(rect.x), y: num(rect.y), width: num(rect.width), height: num(rect.height) },
        });
        return;
      }
      if (data.type === "genetix-select-cancel" && selectModeRef.current) {
        onSelectModeExitRef.current?.();
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
    const injected = iframeNavigationScript(pages) + (selectable ? SELECT_SCRIPT : "");
    const html = i === -1 ? built + injected : built.slice(0, i) + injected + built.slice(i);

    // document.write (instead of srcdoc) keeps the iframe same-origin so generated
    // sites can use localStorage/sessionStorage without throwing.
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.scrollTo(0, 0);
  }, [files, currentPage, pages, selectable]);

  // Apply select mode (runs after the write above, and again whenever the document is rewritten)
  useEffect(() => {
    if (!selectable) return;
    const win = iframeRef.current?.contentWindow as (Window & { __genetixSelect?: SelectApi }) | null | undefined;
    const api = win?.__genetixSelect;
    if (!api) return;
    try {
      if (selectMode) api.enable();
      else api.disable();
    } catch {
      // The preview document may be mid-navigation; the next write re-applies the mode
    }
  }, [selectMode, selectable, files, currentPage, pages]);

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
