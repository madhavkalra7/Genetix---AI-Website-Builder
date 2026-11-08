"use client";

import { memo, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { stageLabel } from "@/components/build-progress";

/* ------------------------------------------------------------------------------------------------
 * Live "Genetix is writing your code" view for the Code tab while a build runs.
 * Build events for the stages writing / editing / fixing carry `file` + `code`; each new snippet
 * is typed out in a dark editor with light syntax colouring.
 * ---------------------------------------------------------------------------------------------- */

type LiveEvent = { seq?: number; at: string; stage: string; detail?: string; file?: string; code?: string };

/** A build started this long before the triggering message still counts as "this run" (clock skew). */
const START_TOLERANCE_MS = 15_000;
/** Slowest typing speed (chars/second) — short snippets still feel like typing. */
const MIN_CHARS_PER_SECOND = 480;
/** Long snippets are sped up so they finish in about this many seconds. */
const TARGET_TYPING_SECONDS = 5;
/** Pause on a finished snippet before the next one starts. */
const HOLD_MS = 900;
/** Queue at most this many snippets (oldest are dropped if the pipeline outpaces the typing). */
const MAX_QUEUE = 3;

/* ---------------------------------------------- tokenizer ------------------------------------- */

type TokType =
    | "plain" | "comment" | "string" | "number" | "keyword" | "literal" | "tag" | "attr"
    | "punct" | "fn" | "prop" | "selector" | "atrule" | "color";
type Tok = { type: TokType; text: string };

const TOKEN_CLASS: Record<TokType, string> = {
    plain: "text-zinc-200",
    comment: "text-zinc-500 italic",
    string: "text-emerald-300",
    number: "text-orange-300",
    keyword: "text-violet-400",
    literal: "text-orange-300",
    tag: "text-rose-400",
    attr: "text-amber-300",
    punct: "text-zinc-500",
    fn: "text-sky-300",
    prop: "text-sky-300",
    selector: "text-amber-200",
    atrule: "text-violet-400",
    color: "text-pink-300",
};

const JS_KEYWORDS = new Set(
    (
        "const let var function return if else for while do switch case break continue new class extends " +
        "import export from default async await try catch finally throw typeof instanceof in of void delete " +
        "yield super static get set as interface type enum implements public private protected readonly"
    ).split(" "),
);
const JS_LITERALS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "this", "document", "window", "console"]);

const JS_RE =
    /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(\b(?:0[xX][\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;
const CALL_AHEAD = /\s*\(/y;

const CSS_RE =
    /(\/\*[\s\S]*?(?:\*\/|$))|("(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?)|(@[\w-]+)|(#[\da-fA-F]{3,8}\b)|(-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?)|(--[\w-]+|[A-Za-z_-][\w-]*)|(\s+)|([\s\S])/g;
/** `name:` followed by a value that ends before any `{` → a declaration, not a selector like `a:hover {`. */
const CSS_PROP_AHEAD = /\s*:[^{}]*?(?:;|\}|$)/y;

function pushTok(out: Tok[], type: TokType, text: string) {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && (last.type === type || (/^\s+$/.test(text) && last.type === "plain"))) last.text += text;
    else out.push({ type, text });
}

function tokenizeJs(src: string, out: Tok[]) {
    JS_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let prevSignificant = "";
    while ((m = JS_RE.exec(src))) {
        const [text, comment, str, num, ident, ws] = m;
        if (comment) pushTok(out, "comment", text);
        else if (str) pushTok(out, "string", text);
        else if (num) pushTok(out, "number", text);
        else if (ident) {
            let type: TokType = "plain";
            if (prevSignificant !== "." && JS_KEYWORDS.has(ident)) type = "keyword";
            else if (prevSignificant !== "." && JS_LITERALS.has(ident)) type = "literal";
            else {
                CALL_AHEAD.lastIndex = JS_RE.lastIndex;
                if (CALL_AHEAD.test(src)) type = "fn";
            }
            pushTok(out, type, text);
        } else if (ws) pushTok(out, "plain", text);
        else pushTok(out, "punct", text);
        if (!ws) prevSignificant = text;
    }
}

function tokenizeCss(src: string, out: Tok[]) {
    CSS_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let inValue = false;
    while ((m = CSS_RE.exec(src))) {
        const [text, comment, str, at, hex, num, ident, ws] = m;
        if (comment) pushTok(out, "comment", text);
        else if (str) pushTok(out, "string", text);
        else if (at) pushTok(out, "atrule", text);
        else if (hex) pushTok(out, inValue ? "color" : "selector", text);
        else if (num) pushTok(out, inValue ? "number" : "selector", text);
        else if (ident) {
            if (inValue) pushTok(out, "plain", text);
            else {
                CSS_PROP_AHEAD.lastIndex = CSS_RE.lastIndex;
                pushTok(out, CSS_PROP_AHEAD.test(src) ? "prop" : "selector", text);
            }
        } else if (ws) pushTok(out, "plain", text);
        else {
            if (text === ":" && !inValue) {
                // A declaration colon (the previous token was a property name)
                const last = out[out.length - 1];
                if (last?.type === "prop") inValue = true;
                pushTok(out, last?.type === "prop" ? "punct" : "selector", text);
                continue;
            }
            if (text === ";" || text === "}" || text === "{") inValue = false;
            pushTok(out, text === "." || text === "#" || text === ">" || text === "*" ? (inValue ? "punct" : "selector") : "punct", text);
        }
    }
}

const TAG_NAME = /[A-Za-z!][\w:.-]*/y;
const ATTR_NAME = /[^\s=>/"']+/y;
const ATTR_VALUE = /"[^"]*"?|'[^']*'?|[^\s>]+/y;
const WS = /\s+/y;

function matchAt(re: RegExp, src: string, at: number): string | null {
    re.lastIndex = at;
    const m = re.exec(src);
    return m ? m[0] : null;
}

function tokenizeHtml(src: string, out: Tok[]) {
    const len = src.length;
    let i = 0;
    while (i < len) {
        if (src.startsWith("<!--", i)) {
            const end = src.indexOf("-->", i + 4);
            const j = end < 0 ? len : end + 3;
            pushTok(out, "comment", src.slice(i, j));
            i = j;
            continue;
        }
        if (src[i] === "<" && /[A-Za-z!/]/.test(src[i + 1] ?? "")) {
            const closing = src[i + 1] === "/";
            pushTok(out, "punct", closing ? "</" : "<");
            i += closing ? 2 : 1;
            const name = matchAt(TAG_NAME, src, i) ?? "";
            pushTok(out, "tag", name);
            i += name.length;
            // Attributes until `>`
            while (i < len && src[i] !== ">") {
                const ws = matchAt(WS, src, i);
                if (ws) {
                    pushTok(out, "plain", ws);
                    i += ws.length;
                    continue;
                }
                if (src[i] === "/" || src[i] === "=") {
                    const isEq = src[i] === "=";
                    pushTok(out, "punct", src[i]);
                    i++;
                    if (isEq) {
                        const value = matchAt(ATTR_VALUE, src, i);
                        if (value) {
                            pushTok(out, "string", value);
                            i += value.length;
                        }
                    }
                    continue;
                }
                const attr = matchAt(ATTR_NAME, src, i);
                if (attr) {
                    pushTok(out, "attr", attr);
                    i += attr.length;
                } else {
                    pushTok(out, "plain", src[i]);
                    i++;
                }
            }
            if (i < len) {
                pushTok(out, "punct", ">");
                i++;
            }
            // Embedded CSS / JS
            const lower = name.toLowerCase();
            if (!closing && (lower === "style" || lower === "script")) {
                const close = src.toLowerCase().indexOf(`</${lower}`, i);
                const end = close < 0 ? len : close;
                const inner = src.slice(i, end);
                if (lower === "style") tokenizeCss(inner, out);
                else tokenizeJs(inner, out);
                i = end;
            }
            continue;
        }
        const next = src.indexOf("<", i + 1);
        const j = next < 0 ? len : next;
        pushTok(out, "plain", src.slice(i, j));
        i = j;
    }
}

type Lang = "html" | "css" | "js";

function languageFor(file: string, code: string): Lang {
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    if (["html", "htm", "vue", "svelte", "xml", "svg"].includes(ext)) return "html";
    if (["css", "scss", "sass", "less"].includes(ext)) return "css";
    if (["js", "mjs", "cjs", "jsx", "ts", "tsx", "json"].includes(ext)) return "js";
    return code.trimStart().startsWith("<") ? "html" : "js";
}

/** Keeps empty lines one line tall. */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

type Seg = { type: TokType; text: string };
type Line = { start: number; end: number; segs: Seg[] };

/** Tokenize once, then split into lines with absolute character offsets (for partial rendering). */
function buildLines(code: string, lang: Lang): Line[] {
    const toks: Tok[] = [];
    if (lang === "html") tokenizeHtml(code, toks);
    else if (lang === "css") tokenizeCss(code, toks);
    else tokenizeJs(code, toks);

    const lines: Line[] = [];
    let current: Line = { start: 0, end: 0, segs: [] };
    let offset = 0;
    for (const tok of toks) {
        const parts = tok.text.split("\n");
        parts.forEach((part, index) => {
            if (index > 0) {
                current.end = offset;
                lines.push(current);
                offset += 1; // the newline
                current = { start: offset, end: offset, segs: [] };
            }
            if (part) {
                current.segs.push({ type: tok.type, text: part });
                offset += part.length;
            }
        });
    }
    current.end = offset;
    lines.push(current);
    return lines;
}

/* ---------------------------------------------- rendering ------------------------------------- */

const Caret = () => (
    <span
        aria-hidden
        className="gx-caret ml-px inline-block h-[1.15em] w-[2px] translate-y-[0.2em] rounded-full bg-sky-400 shadow-[0_0_8px_2px_rgba(56,189,248,0.6)]"
    />
);

interface CodeLineProps {
    line: Line;
    number: number;
    gutter: number;
    /** Characters typed so far (absolute); undefined = whole line. */
    upto?: number;
    caret?: boolean;
}

const CodeLine = memo(function CodeLine({ line, number, gutter, upto, caret }: CodeLineProps) {
    let remaining = upto === undefined ? Infinity : Math.max(0, upto - line.start);
    const parts: ReactNode[] = [];
    for (let i = 0; i < line.segs.length && remaining > 0; i++) {
        const seg = line.segs[i];
        const text = seg.text.length > remaining ? seg.text.slice(0, remaining) : seg.text;
        remaining -= text.length;
        parts.push(
            <span key={i} className={TOKEN_CLASS[seg.type]}>
                {text}
            </span>,
        );
    }
    return (
        <div className={cn("flex min-w-0", caret && "bg-sky-400/[0.06]")}>
            <span
                aria-hidden
                className={cn(
                    "sticky left-0 shrink-0 select-none pr-3 text-right tabular-nums sm:pr-4",
                    caret ? "text-zinc-300" : "text-zinc-600",
                )}
                style={{ width: `${gutter + 2}ch` }}
            >
                {number}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {parts}
                {caret && <Caret />}
                {!parts.length && !caret && ZERO_WIDTH_SPACE}
            </span>
        </div>
    );
});

function fileBadge(file: string): { label: string; className: string } {
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "html" || ext === "htm") return { label: "<>", className: "text-orange-400" };
    if (["css", "scss", "sass", "less"].includes(ext)) return { label: "#", className: "text-sky-400" };
    if (["js", "mjs", "cjs", "jsx"].includes(ext)) return { label: "JS", className: "text-yellow-300" };
    if (["ts", "tsx"].includes(ext)) return { label: "TS", className: "text-blue-400" };
    if (ext === "json") return { label: "{}", className: "text-amber-300" };
    return { label: "•", className: "text-zinc-400" };
}

const baseName = (file: string) => file.split("/").pop() || file;

/* ---------------------------------------------- labels ---------------------------------------- */

const STAGE_PROGRESS: Record<string, number> = {
    starting: 0.04,
    searching: 0.1,
    planning: 0.18,
    writing: 0.4,
    editing: 0.5,
    checking: 0.62,
    fixing: 0.7,
    reviewing: 0.78,
    "browser-testing": 0.85,
    "design-review": 0.9,
    saving: 0.96,
    done: 1,
};

function liveStageLabel(stage: string, detail: string | undefined, file: string | undefined, qaIssues: number): string {
    switch (stage) {
        case "starting":
            return "Warming up the editor…";
        case "planning":
            return "Planning your project…";
        case "searching":
            return "Searching the web…";
        case "writing":
            return file ? `Writing ${baseName(file)}…` : "Writing code…";
        case "editing":
            return file ? `Editing ${baseName(file)}…` : "Editing code…";
        case "reviewing":
            return "Reviewer is polishing your code…";
        case "browser-testing":
            return "Testing in a real browser…";
        case "design-review":
            return "Reviewing the design…";
        case "saving":
            return "Saving your new version…";
        default:
            return stageLabel(stage, detail, qaIssues, true);
    }
}

const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
};

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);
    return reduced;
}

/* Small keyframes, scoped by a `gx-` prefix. Disabled entirely for reduced motion. */
const STYLES = `
@keyframes gx-blink { 0%, 45% { opacity: 1 } 50%, 95% { opacity: 0 } 100% { opacity: 1 } }
@keyframes gx-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
@keyframes gx-flow { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
@keyframes gx-ping { 0% { transform: scale(1); opacity: .75 } 80%, 100% { transform: scale(2.4); opacity: 0 } }
@keyframes gx-fade-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
.gx-caret { animation: gx-blink 1.05s steps(1) infinite }
.gx-shimmer { background: linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.12) 40%, rgba(255,255,255,.04) 80%); background-size: 200% 100%; animation: gx-shimmer 1.8s linear infinite }
.gx-flow { background-image: linear-gradient(90deg, #38bdf8, #a78bfa, #f472b6, #38bdf8); background-size: 200% 100%; animation: gx-flow 2.2s linear infinite }
.gx-ping { animation: gx-ping 1.4s cubic-bezier(0,0,.2,1) infinite }
.gx-fade-in { animation: gx-fade-in .35s ease-out both }
@media (prefers-reduced-motion: reduce) {
  .gx-caret, .gx-shimmer, .gx-flow, .gx-ping, .gx-fade-in { animation: none }
}
`;

/* ---------------------------------------------- component ------------------------------------- */

interface CodeWritingAnimationProps {
    projectId: string;
    isApp?: boolean;
    /** When the run we're showing was requested (the USER message's createdAt). Older builds are ignored. */
    since?: Date | string | number | null;
    className?: string;
}

export function CodeWritingAnimation({ projectId, isApp = false, since, className }: CodeWritingAnimationProps) {
    const trpc = useTRPC();
    const sinceMs = since ? new Date(since).getTime() : null;

    const { data: build } = useQuery(
        trpc.builds.getLatest.queryOptions(
            { projectId, isApp },
            {
                refetchInterval: (query) => {
                    const latest = query.state.data;
                    if (query.state.error) return 5000;
                    if (!latest || latest.status === "running") return 1500;
                    if (sinceMs && new Date(latest.startedAt).getTime() < sinceMs - START_TOLERANCE_MS) return 1500;
                    return false;
                },
                refetchIntervalInBackground: false,
                retry: 1,
            },
        ),
    );

    const run =
        build && (!sinceMs || new Date(build.startedAt).getTime() >= sinceMs - START_TOLERANCE_MS) ? build : null;

    return (
        <div
            className={cn(
                "relative flex h-full min-h-[400px] w-full flex-col overflow-hidden bg-[#0b0e14] text-zinc-200",
                className,
            )}
        >
            <style>{STYLES}</style>
            <LiveEditor
                key={run ? run.id : "pending"}
                events={run ? (run.events as LiveEvent[]) : EMPTY_EVENTS}
                stage={run ? run.stage : "starting"}
                status={run ? run.status : "running"}
                qaIssues={run ? run.qaIssues : 0}
                startedAt={run ? new Date(run.startedAt).getTime() : (sinceMs ?? null)}
            />
        </div>
    );
}

const EMPTY_EVENTS: LiveEvent[] = [];

type Job = { key: string; file: string; code: string; stage: string };

interface LiveEditorProps {
    events: LiveEvent[];
    stage: string;
    status: string;
    qaIssues: number;
    startedAt: number | null;
}

function LiveEditor({ events, stage, status, qaIssues, startedAt }: LiveEditorProps) {
    const reducedMotion = usePrefersReducedMotion();

    // ---- typing engine ----
    const queueRef = useRef<Job[]>([]);
    const seenRef = useRef<Set<string>>(new Set());
    const currentRef = useRef<Job | null>(null);
    const [current, setCurrent] = useState<Job | null>(null);
    const [typed, setTyped] = useState(0);
    const [tabs, setTabs] = useState<string[]>([]);
    const [buffers, setBuffers] = useState<Record<string, Job>>({});
    const [pinned, setPinned] = useState<string | null>(null);
    const [lastFile, setLastFile] = useState<string | null>(null);

    const startNext = useCallback(() => {
        const next = queueRef.current.shift() ?? null;
        currentRef.current = next;
        setCurrent(next);
        setTyped(0);
        if (next) {
            setPinned(null); // follow the writer again
            setLastFile(next.file);
        }
    }, []);

    // Collect new snippets + file names from the polled events
    useEffect(() => {
        const newFiles: string[] = [];
        let added = false;
        events.forEach((event, index) => {
            if (event.file && !newFiles.includes(event.file)) newFiles.push(event.file);
            if (!event.code || !event.file) return;
            const key = event.seq !== undefined ? `s${event.seq}` : `${event.at}|${event.file}|${index}`;
            if (seenRef.current.has(key)) return;
            seenRef.current.add(key);
            queueRef.current.push({ key, file: event.file, code: event.code, stage: event.stage });
            added = true;
        });
        if (newFiles.length) {
            setTabs((prev) => {
                const missing = newFiles.filter((f) => !prev.includes(f));
                return missing.length ? [...prev, ...missing] : prev;
            });
        }
        if (added) {
            if (queueRef.current.length > MAX_QUEUE) queueRef.current = queueRef.current.slice(-MAX_QUEUE);
            if (!currentRef.current) startNext();
        }
    }, [events, startNext]);

    // Type the current snippet out
    useEffect(() => {
        if (!current) return;
        const total = current.code.length;
        const finish = () => {
            setBuffers((prev) => ({ ...prev, [current.file]: current }));
            startNext();
        };
        if (reducedMotion || total === 0) {
            setTyped(total);
            const hold = window.setTimeout(finish, HOLD_MS);
            return () => window.clearTimeout(hold);
        }
        const cps = Math.max(MIN_CHARS_PER_SECOND, total / TARGET_TYPING_SECONDS);
        let pos = 0;
        let last = performance.now();
        let raf = 0;
        let hold = 0;
        const step = (now: number) => {
            const dt = Math.min(64, now - last);
            last = now;
            // Catch up when more snippets are waiting
            const boost = 1 + queueRef.current.length * 0.75;
            pos = Math.min(total, pos + (cps * boost * dt) / 1000);
            setTyped(Math.floor(pos));
            if (pos < total) raf = requestAnimationFrame(step);
            else hold = window.setTimeout(finish, HOLD_MS);
        };
        raf = requestAnimationFrame(step);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(hold);
        };
    }, [current, reducedMotion, startNext]);

    // ---- what's on screen ----
    const viewFile = pinned ?? current?.file ?? lastFile;
    const isTypingView = !!current && viewFile === current.file;
    const shown: Job | null = isTypingView ? current : viewFile ? (buffers[viewFile] ?? null) : null;
    const lines = useMemo(() => (shown ? buildLines(shown.code, languageFor(shown.file, shown.code)) : []), [shown]);
    const upto = isTypingView ? typed : (shown?.code.length ?? 0);
    const caretLine = useMemo(() => {
        let idx = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].start <= upto) idx = i;
            else break;
        }
        return idx;
    }, [lines, upto]);
    const gutter = Math.max(2, String(lines.length).length);

    // ---- auto-scroll (follow the caret unless the user scrolled up) ----
    const scrollRef = useRef<HTMLDivElement>(null);
    const followRef = useRef(true);
    useEffect(() => {
        followRef.current = true;
    }, [shown?.key]);
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || !followRef.current) return;
        if (isTypingView) el.scrollTop = el.scrollHeight;
    }, [caretLine, isTypingView, shown?.key]);
    useLayoutEffect(() => {
        // Switching tabs manually: start at the top
        if (!isTypingView && scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [isTypingView, viewFile]);
    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    };

    // ---- status ----
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);
    const lastEvent = events[events.length - 1];
    const currentStage = status === "running" && stage && stage !== lastEvent?.stage ? stage : (lastEvent?.stage ?? stage);
    const finished = status !== "running";
    const failed = status === "failed" || currentStage === "failed";
    const typingFile = current?.file;
    const statusLabel = failed
        ? "Build stopped"
        : finished
          ? "Finishing up…"
          : typingFile && (currentStage === "writing" || currentStage === "editing" || currentStage === "fixing")
            ? liveStageLabel(current!.stage, undefined, typingFile, qaIssues)
            : liveStageLabel(currentStage, lastEvent?.detail, lastEvent?.file, qaIssues);

    const progressRef = useRef(0);
    const stageProgress = finished ? 1 : (STAGE_PROGRESS[currentStage] ?? progressRef.current);
    progressRef.current = Math.max(progressRef.current, stageProgress);
    const progress = progressRef.current;

    const hasCode = !!shown;

    return (
        <>
            {/* ambient glow */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl"
            />

            {/* title / tab bar */}
            <div className="relative flex h-10 shrink-0 items-stretch border-b border-white/[0.06] bg-[#0f131b]">
                <div className="hidden items-center gap-1.5 px-3 sm:flex" aria-hidden>
                    <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
                    <span className="size-2.5 rounded-full bg-[#28c840]/80" />
                </div>
                <div
                    className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="tablist"
                    aria-label="Files being written"
                >
                    {tabs.length === 0 && (
                        <div className="flex items-center gap-2 px-3 text-xs text-zinc-500">
                            <span className="gx-shimmer h-2.5 w-20 rounded" />
                        </div>
                    )}
                    {tabs.map((file) => {
                        const active = file === viewFile;
                        const writing = file === typingFile;
                        const badge = fileBadge(file);
                        const available = writing || !!buffers[file];
                        return (
                            <button
                                key={file}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                disabled={!available}
                                title={file}
                                onClick={() => setPinned(writing ? null : file)}
                                className={cn(
                                    "gx-fade-in relative flex shrink-0 items-center gap-1.5 border-r border-white/[0.06] px-3 font-mono text-xs transition-colors",
                                    active ? "bg-[#0b0e14] text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                                    !available && "cursor-default opacity-60 hover:text-zinc-500",
                                )}
                            >
                                {active && <span aria-hidden className="gx-flow absolute inset-x-0 top-0 h-[2px]" />}
                                <span className={cn("text-[10px] font-bold", badge.className)}>{badge.label}</span>
                                <span className="max-w-[9rem] truncate">{baseName(file)}</span>
                                {writing && (
                                    <span className="relative ml-0.5 flex size-1.5" aria-label="being written">
                                        <span className="gx-ping absolute inline-flex size-full rounded-full bg-sky-400" />
                                        <span className="relative inline-flex size-1.5 rounded-full bg-sky-400" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 px-3 text-xs">
                    <span className="hidden bg-gradient-to-r from-sky-300 via-violet-300 to-pink-300 bg-clip-text font-medium text-transparent sm:inline">
                        Genetix is writing your code
                    </span>
                </div>
            </div>

            {/* editor body */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 pr-3 font-mono text-[11.5px] leading-[1.65] sm:text-[13px]"
                aria-live="off"
                aria-label={shown ? `Code for ${shown.file}` : "Waiting for code"}
            >
                {hasCode ? (
                    <div key={shown!.key}>
                        {lines.map((line, i) => {
                            if (i > caretLine) return null;
                            const isCaretLine = i === caretLine;
                            return (
                                <CodeLine
                                    key={i}
                                    line={line}
                                    number={i + 1}
                                    gutter={gutter}
                                    upto={isCaretLine ? upto : undefined}
                                    caret={isCaretLine}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <ThinkingState label={failed ? "Build stopped" : statusLabel} />
                )}
            </div>

            {/* status footer */}
            <div className="relative shrink-0 border-t border-white/[0.06] bg-[#0f131b] px-3 py-2" role="status" aria-live="polite">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                    <span className="relative flex size-2 shrink-0">
                        {!finished && <span className="gx-ping absolute inline-flex size-full rounded-full bg-emerald-400" />}
                        <span
                            className={cn(
                                "relative inline-flex size-2 rounded-full",
                                failed ? "bg-red-400" : "bg-emerald-400",
                            )}
                        />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-zinc-300">{statusLabel}</span>
                    {typingFile && isTypingView && current!.code.length > 0 && (
                        <span className="hidden shrink-0 tabular-nums text-zinc-500 sm:inline">
                            {Math.round((upto / current!.code.length) * 100)}%
                        </span>
                    )}
                    {startedAt && (
                        <span className="shrink-0 tabular-nums text-zinc-500" title="Elapsed time">
                            {formatDuration(now - startedAt)}
                        </span>
                    )}
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", failed ? "bg-red-400" : "gx-flow")}
                        style={{ width: `${Math.round(Math.max(0.04, progress) * 100)}%` }}
                    />
                </div>
            </div>
        </>
    );
}

const SKELETON_LINES: Array<[indent: number, width: number]> = [
    [0, 38], [1, 55], [2, 70], [2, 48], [1, 30], [1, 62], [2, 80], [3, 44], [3, 58], [2, 36],
    [1, 50], [0, 24], [0, 42], [1, 66], [2, 52], [1, 28],
];

function ThinkingState({ label }: { label: string }) {
    return (
        <div className="relative h-full min-h-[300px]">
            <div aria-hidden className="flex flex-col gap-[0.55rem] pt-1">
                {SKELETON_LINES.map(([indent, width], i) => (
                    <div key={i} className="flex items-center">
                        <span className="w-[4ch] shrink-0 pr-3 text-right tabular-nums text-zinc-700 sm:pr-4">{i + 1}</span>
                        <span
                            className="gx-shimmer h-2.5 rounded"
                            style={{
                                marginLeft: `${indent * 1.25}rem`,
                                width: `min(${width}%, calc(100% - ${indent * 1.25}rem))`,
                                animationDelay: `${i * 70}ms`,
                            }}
                        />
                    </div>
                ))}
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
                <div className="gx-fade-in flex max-w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0f131b]/90 px-4 py-3 font-sans shadow-2xl shadow-sky-500/10 backdrop-blur">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-100">{label}</div>
                        <div className="text-xs text-zinc-500">Code will appear here as it&apos;s written</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
