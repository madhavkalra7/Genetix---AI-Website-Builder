"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlignCenterIcon,
    AlignJustifyIcon,
    AlignLeftIcon,
    AlignRightIcon,
    Loader2Icon,
    MousePointerClickIcon,
    PaletteIcon,
    RotateCcwIcon,
    SaveIcon,
    SendIcon,
    SparklesIcon,
    XIcon,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ElementStylePreview, SelectedElementInfo } from "@/components/html-preview";

const MAX_REQUEST_LENGTH = 2000;
const MAX_TEXT_LENGTH = 500;

export const buildElementEditPrompt = (element: SelectedElementInfo, request: string) =>
    `Edit ONLY this element and keep everything else unchanged.\nElement: ${element.selector}\nCurrent HTML (truncated):\n${element.html}\n\nRequested change: ${request.trim()}`;

const buildTextEditPrompt = (element: SelectedElementInfo, text: string) =>
    buildElementEditPrompt(
        element,
        `Change the text of ${element.selector} to: ${text.trim()}\nKeep its tag, classes, attributes and styling exactly as they are.`,
    );

const elementLabel = (element: SelectedElementInfo) => {
    const text = element.text.trim();
    const snippet = text.length > 40 ? text.slice(0, 39) + "…" : text;
    return snippet ? `<${element.tag}> “${snippet}”` : `<${element.tag}>`;
};

// ---------------------------------------------------------------------------
// Visual-edit value helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const toHexByte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0");

/** Any computed CSS colour -> #rrggbb / #rrggbbaa ("" if it can't be read) */
function cssColorToHex(value: string): string {
    const v = value.trim();
    if (HEX_RE.test(v)) return v.toLowerCase();
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(v);
    let rgba: [number, number, number, number] | null = null;
    if (m) {
        const alpha = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
        rgba = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), alpha];
    } else if (typeof document !== "undefined" && v) {
        // oklch()/color()/named colours: let the browser rasterise one pixel
        try {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
                ctx.fillStyle = v;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                rgba = [r, g, b, a / 255];
            }
        } catch {
            rgba = null;
        }
    }
    if (!rgba) return "";
    const [r, g, b, a] = rgba;
    const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return a >= 1 ? hex : hex + toHexByte(a * 255);
}

/** #rgb / #rgba / #rrggbbaa -> #rrggbb for <input type="color"> */
const toColorInputValue = (hex: string) => {
    if (!HEX_RE.test(hex)) return "#000000";
    const h = hex.slice(1);
    if (h.length <= 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
    return `#${h.slice(0, 6)}`.toLowerCase();
};

const px = (v: string | undefined, fallback = 0) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : fallback;
};

const normalizeAlign = (v: string | undefined) => {
    if (v === "start" || v === "-webkit-left") return "left";
    if (v === "end" || v === "-webkit-right") return "right";
    if (v === "-webkit-center") return "center";
    return v && ["left", "right", "center", "justify"].includes(v) ? v : "left";
};

interface VisualValues {
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontWeight: string;
    padding: number;
    borderRadius: number;
    textAlign: string;
    opacity: number;
    hidden: boolean;
    text: string;
}

function initialValues(element: SelectedElementInfo): VisualValues {
    const c = element.computed;
    const weight = c?.fontWeight === "normal" ? "400" : c?.fontWeight === "bold" ? "700" : (c?.fontWeight ?? "400");
    return {
        color: cssColorToHex(c?.color ?? ""),
        backgroundColor: cssColorToHex(c?.backgroundColor ?? ""),
        fontSize: px(c?.fontSize, 16),
        fontWeight: /^[1-9]00$/.test(weight) ? weight : "400",
        padding: px(c?.padding),
        borderRadius: px(c?.borderRadius),
        textAlign: normalizeAlign(c?.textAlign),
        opacity: Math.max(0, Math.min(1, px(c?.opacity, 1))),
        hidden: c?.display === "none",
        text: element.text,
    };
}

const formatOpacity = (o: number) => String(Math.round(o * 100) / 100);
const formatPx = (n: number) => `${Math.round(n * 100) / 100}px`;

/** Only the properties the user actually changed (server whitelist names). "" = remove override. */
function styleDiff(initial: VisualValues, current: VisualValues): Record<string, string> {
    const out: Record<string, string> = {};
    if (current.color !== initial.color && HEX_RE.test(current.color)) out.color = current.color;
    if (current.backgroundColor !== initial.backgroundColor && HEX_RE.test(current.backgroundColor)) {
        out["background-color"] = current.backgroundColor;
    }
    if (current.fontSize !== initial.fontSize && current.fontSize >= 1) out["font-size"] = formatPx(current.fontSize);
    if (current.fontWeight !== initial.fontWeight) out["font-weight"] = current.fontWeight;
    if (current.padding !== initial.padding && current.padding >= 0) out.padding = formatPx(current.padding);
    if (current.borderRadius !== initial.borderRadius && current.borderRadius >= 0) {
        out["border-radius"] = formatPx(current.borderRadius);
    }
    if (current.textAlign !== initial.textAlign) out["text-align"] = current.textAlign;
    if (current.opacity !== initial.opacity) out.opacity = formatOpacity(current.opacity);
    if (current.hidden !== initial.hidden) out.display = current.hidden ? "none" : "";
    return out;
}

const FONT_WEIGHTS = [
    ["100", "Thin"],
    ["200", "Extra light"],
    ["300", "Light"],
    ["400", "Regular"],
    ["500", "Medium"],
    ["600", "Semibold"],
    ["700", "Bold"],
    ["800", "Extra bold"],
    ["900", "Black"],
] as const;

const ALIGNMENTS = [
    { value: "left", label: "Align left", Icon: AlignLeftIcon },
    { value: "center", label: "Align center", Icon: AlignCenterIcon },
    { value: "right", label: "Align right", Icon: AlignRightIcon },
    { value: "justify", label: "Justify", Icon: AlignJustifyIcon },
] as const;

// ---------------------------------------------------------------------------
// Small controls
// ---------------------------------------------------------------------------

function ColorField({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`${id}-hex`} className="text-[11px] font-medium text-muted-foreground">
                {label}
            </label>
            <div className="flex items-center gap-1.5">
                <input
                    type="color"
                    aria-label={`${label} picker`}
                    value={toColorInputValue(value)}
                    onChange={(e) => onChange(e.target.value)}
                    className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                />
                <Input
                    id={`${id}-hex`}
                    value={draft}
                    placeholder="#000000"
                    maxLength={9}
                    spellCheck={false}
                    aria-invalid={!!draft && !HEX_RE.test(draft)}
                    onChange={(e) => {
                        const next = e.target.value.trim();
                        setDraft(next);
                        if (HEX_RE.test(next)) onChange(next.toLowerCase());
                    }}
                    onBlur={() => setDraft(value)}
                    className="h-8 min-w-0 px-2 font-mono text-xs"
                />
            </div>
        </div>
    );
}

function NumberField({
    id,
    label,
    value,
    min,
    max,
    step = 1,
    unit,
    onChange,
}: {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit: string;
    onChange: (v: number) => void;
}) {
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
                    {label}
                </label>
                <div className="flex items-center gap-0.5">
                    <input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={min}
                        max={max}
                        step={step}
                        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
                        onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            if (Number.isFinite(n)) onChange(clamp(n));
                        }}
                        className="h-6 w-14 rounded border bg-transparent px-1 text-right font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="w-4 text-[10px] text-muted-foreground">{unit}</span>
                </div>
            </div>
            <Slider
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={[clamp(value)]}
                onValueChange={([v]) => onChange(v)}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Visual tab
// ---------------------------------------------------------------------------

interface VisualEditorProps {
    projectId: string;
    fragmentId: string;
    element: SelectedElementInfo;
    /** Whether the Visual tab is showing (preview is only applied while it is) */
    active: boolean;
    onPreviewChange?: (preview: ElementStylePreview | null) => void;
    onSaved: () => void;
    onTextSent: () => void;
    onCancel: () => void;
    onBusyChange: (busy: boolean) => void;
}

function VisualEditor({
    projectId,
    fragmentId,
    element,
    active,
    onPreviewChange,
    onSaved,
    onTextSent,
    onCancel,
    onBusyChange,
}: VisualEditorProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();
    const { data: usage } = useQuery(trpc.usage.status.queryOptions());

    const initial = useMemo(() => initialValues(element), [element]);
    const [values, setValues] = useState<VisualValues>(initial);
    const set = <K extends keyof VisualValues>(key: K, value: VisualValues[K]) =>
        setValues((prev) => ({ ...prev, [key]: value }));

    const canEditText = element.isLeaf === true && element.tag !== "img" && element.tag !== "input";
    const styles = useMemo(() => styleDiff(initial, values), [initial, values]);
    const textChanged = canEditText && values.text.trim() !== initial.text.trim() && values.text.trim().length > 0;
    const hasStyleChanges = Object.keys(styles).length > 0;
    const dirty = hasStyleChanges || textChanged;

    // Live preview in the iframe (zero tokens, nothing saved yet)
    const onPreviewChangeRef = useRef(onPreviewChange);
    useEffect(() => {
        onPreviewChangeRef.current = onPreviewChange;
    });
    useEffect(() => {
        const send = onPreviewChangeRef.current;
        if (!send) return;
        if (!active || !dirty) {
            send(null);
            return;
        }
        send({ selector: element.selector, styles, text: textChanged ? values.text : undefined });
    }, [active, dirty, element.selector, styles, textChanged, values.text]);
    useEffect(() => () => onPreviewChangeRef.current?.(null), []);

    const applyVisualEdit = useMutation(trpc.fragments.applyVisualEdit.mutationOptions());
    const createMessage = useMutation(trpc.messages.create.mutationOptions());
    const pending = applyVisualEdit.isPending || createMessage.isPending;

    useEffect(() => {
        onBusyChange(pending);
    }, [pending, onBusyChange]);

    const save = async () => {
        if (!dirty || pending) return;
        try {
            if (hasStyleChanges) {
                await applyVisualEdit.mutateAsync({ fragmentId, selector: element.selector, styles });
                await queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
                toast.success("Saved instantly — no credits used");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn't save visual edits");
            return;
        }
        if (!textChanged) {
            onSaved();
            return;
        }
        try {
            await createMessage.mutateAsync({
                projectId,
                value: buildTextEditPrompt(element, values.text),
                mode: "quick",
            });
            queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
            queryClient.invalidateQueries(trpc.usage.status.queryOptions());
            toast.success("Text change requested — rebuilding");
            onTextSent();
        } catch (error) {
            const err = error as { message?: string; data?: { code?: string } };
            toast.error(err.message ?? "Couldn't send the text change");
            if (err.data?.code === "TOO_MANY_REQUESTS" && !usage?.aiquestMode) router.push("/pricing");
        }
    };

    if (!element.computed) {
        return (
            <p className="py-2 text-xs text-muted-foreground">
                Styles for this element couldn&apos;t be read. Refresh the preview and select it again, or use Ask AI.
            </p>
        );
    }

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                void save();
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }}
        >
            <fieldset disabled={pending} className="contents">
                {canEditText && (
                    <div className="flex flex-col gap-1">
                        <label htmlFor="visual-text" className="text-[11px] font-medium text-muted-foreground">
                            Text <span className="font-normal">(saving a text change uses 1 credit)</span>
                        </label>
                        <Input
                            id="visual-text"
                            value={values.text}
                            maxLength={MAX_TEXT_LENGTH}
                            onChange={(e) => set("text", e.target.value.slice(0, MAX_TEXT_LENGTH))}
                            className="h-8 text-xs"
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <ColorField id="visual-color" label="Text colour" value={values.color} onChange={(v) => set("color", v)} />
                    <ColorField
                        id="visual-bg"
                        label="Background"
                        value={values.backgroundColor}
                        onChange={(v) => set("backgroundColor", v)}
                    />
                    <NumberField
                        id="visual-font-size"
                        label="Font size"
                        unit="px"
                        min={6}
                        max={160}
                        value={values.fontSize}
                        onChange={(v) => set("fontSize", v)}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <label htmlFor="visual-weight" className="text-[11px] font-medium text-muted-foreground">
                            Font weight
                        </label>
                        <select
                            id="visual-weight"
                            value={values.fontWeight}
                            onChange={(e) => set("fontWeight", e.target.value)}
                            className="h-8 rounded-md border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {FONT_WEIGHTS.map(([w, name]) => (
                                <option key={w} value={w}>
                                    {w} · {name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <NumberField
                        id="visual-padding"
                        label="Padding"
                        unit="px"
                        min={0}
                        max={200}
                        value={values.padding}
                        onChange={(v) => set("padding", v)}
                    />
                    <NumberField
                        id="visual-radius"
                        label="Corner radius"
                        unit="px"
                        min={0}
                        max={200}
                        value={values.borderRadius}
                        onChange={(v) => set("borderRadius", v)}
                    />
                    <NumberField
                        id="visual-opacity"
                        label="Opacity"
                        unit="%"
                        min={0}
                        max={100}
                        value={Math.round(values.opacity * 100)}
                        onChange={(v) => set("opacity", Math.round(v) / 100)}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <span id="visual-align-label" className="text-[11px] font-medium text-muted-foreground">
                            Alignment
                        </span>
                        <div role="radiogroup" aria-labelledby="visual-align-label" className="flex gap-1">
                            {ALIGNMENTS.map(({ value, label, Icon }) => (
                                <Button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={values.textAlign === value}
                                    aria-label={label}
                                    title={label}
                                    size="icon"
                                    variant={values.textAlign === value ? "default" : "outline"}
                                    className="size-7"
                                    onClick={() => set("textAlign", value)}
                                >
                                    <Icon />
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <label htmlFor="visual-hidden" className="text-xs">
                        Hide element
                    </label>
                    <Switch id="visual-hidden" checked={values.hidden} onCheckedChange={(v) => set("hidden", v)} />
                </div>
            </fieldset>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!dirty || pending}
                    onClick={() => setValues(initial)}
                >
                    <RotateCcwIcon />
                    Reset
                </Button>
                <span className="ml-auto text-right text-[10px] leading-tight text-muted-foreground">
                    {textChanged ? (hasStyleChanges ? "Styles free · text uses 1 credit" : "Uses 1 credit") : "Free · no credits"}
                </span>
                <Button type="submit" size="sm" disabled={!dirty || pending}>
                    {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                    Save
                </Button>
            </div>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface Props {
    projectId: string;
    /** Version shown in the preview (visual edits are saved on top of the latest version) */
    fragmentId: string;
    /** null = select mode on, nothing picked yet */
    element: SelectedElementInfo | null;
    /** Changes every time an element is picked (resets the Visual controls) */
    selectionKey?: number;
    onCancel: () => void;
    /** An AI edit was sent as a chat message */
    onSent: () => void;
    /** Visual edits were saved as a new version (no AI run) */
    onVisualSaved?: () => void;
    /** Live preview of unsaved visual edits */
    onPreviewChange?: (preview: ElementStylePreview | null) => void;
}

/** Docked at the bottom of the preview while click-to-edit is active. */
export function ElementEditPanel({
    projectId,
    fragmentId,
    element,
    selectionKey = 0,
    onCancel,
    onSent,
    onVisualSaved,
    onPreviewChange,
}: Props) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();
    const [request, setRequest] = useState("");
    const [tab, setTab] = useState<"visual" | "ai">("visual");
    const [visualBusy, setVisualBusy] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { data: usage } = useQuery(trpc.usage.status.queryOptions());

    // Same mutation + credit handling as the chat form (message-form.tsx)
    const createMessage = useMutation(
        trpc.messages.create.mutationOptions({
            onSuccess: () => {
                setRequest("");
                queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
                queryClient.invalidateQueries(trpc.usage.status.queryOptions());
                toast.success("Edit requested — rebuilding");
                onSent();
            },
            onError: (error) => {
                toast.error(error.message);
                if (error.data?.code === "TOO_MANY_REQUESTS" && !usage?.aiquestMode) {
                    router.push("/pricing");
                }
            },
        }),
    );

    // Focus the request box as soon as an element is picked (Ask AI tab)
    useEffect(() => {
        if (element && tab === "ai") textareaRef.current?.focus();
    }, [element, tab]);

    const busy = createMessage.isPending || visualBusy;
    const canSend = !!element && request.trim().length > 0 && !createMessage.isPending;

    const send = () => {
        if (!element || !canSend) return;
        // "quick" = fast targeted edit (seconds), not the full build pipeline
        createMessage.mutate({ projectId, value: buildElementEditPrompt(element, request), mode: "quick" });
    };

    return (
        <div
            className="absolute inset-x-2 bottom-2 z-10 max-h-[calc(100%-1rem)] overflow-y-auto rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:w-96"
            role="dialog"
            aria-label="Edit selected element"
        >
            <div className="flex items-center gap-2">
                <MousePointerClickIcon className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                    {element ? (
                        <p className="truncate font-mono text-xs" title={element.selector}>
                            {elementLabel(element)}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Click an element in the preview to edit it · Esc to cancel
                        </p>
                    )}
                </div>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    onClick={onCancel}
                    aria-label="Cancel element editing"
                    disabled={busy}
                >
                    <XIcon />
                </Button>
            </div>

            {element && (
                <Tabs value={tab} onValueChange={(v) => setTab(v as "visual" | "ai")} className="mt-2 gap-2">
                    <TabsList className="h-8 w-full">
                        <TabsTrigger value="visual" className="text-xs">
                            <PaletteIcon /> Visual
                        </TabsTrigger>
                        <TabsTrigger value="ai" className="text-xs">
                            <SparklesIcon /> Ask AI
                        </TabsTrigger>
                    </TabsList>

                    {/* forceMount keeps unsaved visual changes when switching tabs */}
                    <TabsContent value="visual" forceMount className="data-[state=inactive]:hidden">
                        <VisualEditor
                            key={selectionKey}
                            projectId={projectId}
                            fragmentId={fragmentId}
                            element={element}
                            active={tab === "visual"}
                            onPreviewChange={onPreviewChange}
                            onSaved={() => onVisualSaved?.()}
                            onTextSent={onSent}
                            onCancel={onCancel}
                            onBusyChange={setVisualBusy}
                        />
                    </TabsContent>

                    <TabsContent value="ai">
                        <form
                            className="flex flex-col gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                send();
                            }}
                        >
                            <label htmlFor="element-edit-request" className="sr-only">
                                What should change?
                            </label>
                            <Textarea
                                id="element-edit-request"
                                ref={textareaRef}
                                value={request}
                                onChange={(e) => setRequest(e.target.value.slice(0, MAX_REQUEST_LENGTH))}
                                placeholder="What should change?"
                                rows={3}
                                maxLength={MAX_REQUEST_LENGTH}
                                disabled={createMessage.isPending}
                                className="min-h-16 max-h-40 resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        send();
                                    } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        onCancel();
                                    }
                                }}
                            />
                            <div className="flex items-center justify-between gap-2">
                                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                                    ⌘/Ctrl+Enter to send · uses 1 credit
                                </span>
                                <Button type="submit" size="sm" className="ml-auto" disabled={!canSend}>
                                    {createMessage.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                                    Send
                                </Button>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
