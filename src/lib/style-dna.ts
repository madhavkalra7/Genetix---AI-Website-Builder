import { z } from "zod";
import { appendThemeBlock, buildCustomThemePromptBlock } from "@/lib/theme-presets";

/**
 * Style DNA: paste a website URL → extract its design system (palette, fonts, radius feel, mood)
 * as a reusable theme. Only the *vibe* is copied — never text, images, logos or layout.
 *
 * This module is pure (no Node-only imports) so it can be shared by client and server code and
 * unit-tested: URL normalisation/validation, IP blocklists for the SSRF guard, HTML/CSS signal
 * extraction, the compact summary sent to the model, the strict result schema and prompt rendering.
 * The network side lives in src/modules/style-dna/server.
 */

// ---------------------------------------------------------------------------------------------
// Result schema (shared by the extract procedure and the create mutations)
// ---------------------------------------------------------------------------------------------

export const STYLE_DNA_RADII = ["sharp", "soft", "rounded", "pill"] as const;
export type StyleDnaRadius = (typeof STYLE_DNA_RADII)[number];

const HEX_RE = /^#[0-9A-F]{6}$/;
const FONT_RE = /^[A-Za-z0-9 ]{1,40}$/;
const NAME_RE = /^[A-Za-z0-9&'+ -]{2,40}$/;
/** Single-line text without quotes, backticks, angle brackets or braces. */
const SAFE_TEXT_RE = /^[A-Za-z0-9 ,.;:'&()/+!?%#-]*$/;
const HOST_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const hex = z.string().regex(HEX_RE, { message: "Colours must be #RRGGBB hex" });
const font = z.string().regex(FONT_RE, { message: "Invalid font name" });
const safeText = (max: number) =>
  z.string().min(1).max(max).regex(SAFE_TEXT_RE, { message: "Text contains unsupported characters" });

export const styleDnaSchema = z.strictObject({
  name: z
    .string()
    .regex(NAME_RE, { message: "Invalid style name" })
    .refine((s) => {
      const words = s.trim().split(/\s+/).length;
      return s === s.trim() && words >= 2 && words <= 4;
    }, { message: "Style name must be 2–4 words" }),
  description: safeText(140),
  palette: z.strictObject({ bg: hex, surface: hex, text: hex, muted: hex, primary: hex, accent: hex }),
  fonts: z.strictObject({ display: font, body: font }),
  radius: z.enum(STYLE_DNA_RADII),
  mood: safeText(120),
  tips: z.array(safeText(60)).max(5),
  sourceHost: z.string().max(253).regex(HOST_RE, { message: "Invalid source host" }),
});

export type StyleDna = z.infer<typeof styleDnaSchema>;

/** The part produced by the model (sourceHost is added by the server). */
export type StyleDnaModelOutput = Omit<StyleDna, "sourceHost">;

/** JSON schema for the OpenAI Responses `json_schema` (strict) output format. */
export const STYLE_DNA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "palette", "fonts", "radius", "mood", "tips"],
  properties: {
    name: { type: "string", description: "2–4 word evocative theme name, e.g. 'Calm Fintech Blue'. No brand names." },
    description: { type: "string", description: "One sentence, max 140 characters." },
    palette: {
      type: "object",
      additionalProperties: false,
      required: ["bg", "surface", "text", "muted", "primary", "accent"],
      properties: {
        bg: { type: "string", description: "#RRGGBB page background" },
        surface: { type: "string", description: "#RRGGBB card/surface background" },
        text: { type: "string", description: "#RRGGBB main text" },
        muted: { type: "string", description: "#RRGGBB secondary text" },
        primary: { type: "string", description: "#RRGGBB primary brand/CTA colour" },
        accent: { type: "string", description: "#RRGGBB secondary accent" },
      },
    },
    fonts: {
      type: "object",
      additionalProperties: false,
      required: ["display", "body"],
      properties: {
        display: { type: "string", description: "Google Fonts family for headings" },
        body: { type: "string", description: "Google Fonts family for body text" },
      },
    },
    radius: { type: "string", enum: [...STYLE_DNA_RADII] },
    mood: { type: "string", description: "Max 120 characters describing the overall feel." },
    tips: {
      type: "array",
      description: "Up to 5 short layout/style traits (max 60 chars each).",
      items: { type: "string" },
    },
  },
} as const;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(/[–—]/g, "-")
    .replace(/[‘’“”"`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 ,.;:'&()/+!?%#-]/g, "")
    .trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[ ,;:-]+$/, "");
}

function cleanFont(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const first = value.split(",")[0] ?? "";
  const cleaned = first.replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return cleaned || fallback;
}

function cleanName(value: unknown): string {
  const words = (typeof value === "string" ? value : "")
    .replace(/[^A-Za-z0-9&'+ -]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  while (words.length < 2) words.push(words.length === 0 ? "Custom" : "Style");
  let name = words.join(" ");
  while (name.length > 40 && words.length > 2) {
    words.pop();
    name = words.join(" ");
  }
  return name.slice(0, 40).trim();
}

/**
 * Normalises a loosely-shaped model result (trims, strips unsupported characters, truncates,
 * normalises colours) and then validates it strictly. Returns null when it can't be made valid
 * (e.g. a colour that isn't a colour) — values are never invented beyond trivial fallbacks.
 */
export function sanitizeStyleDna(raw: unknown, sourceHost: string): StyleDna | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = (r.palette && typeof r.palette === "object" ? r.palette : {}) as Record<string, unknown>;
  const f = (r.fonts && typeof r.fonts === "object" ? r.fonts : {}) as Record<string, unknown>;
  const color = (v: unknown) => (typeof v === "string" ? normalizeColorToHex(v) ?? "" : "");
  const body = cleanFont(f.body, "Inter");
  const candidate = {
    name: cleanName(r.name),
    description: cleanText(r.description, 140) || "A custom theme extracted from a website",
    palette: {
      bg: color(p.bg),
      surface: color(p.surface),
      text: color(p.text),
      muted: color(p.muted),
      primary: color(p.primary),
      accent: color(p.accent),
    },
    fonts: { display: cleanFont(f.display, body), body },
    radius: typeof r.radius === "string" ? r.radius.trim().toLowerCase() : "",
    mood: cleanText(r.mood, 120) || "Clean and modern",
    tips: (Array.isArray(r.tips) ? r.tips : [])
      .map((t) => cleanText(t, 60))
      .filter((t) => t.length > 0)
      .slice(0, 5),
    sourceHost: sourceHost.toLowerCase(),
  };
  const parsed = styleDnaSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

const RADIUS_GUIDANCE: Record<StyleDnaRadius, string> = {
  sharp: "0–4px (sharp, crisp corners)",
  soft: "6–10px (softly rounded)",
  rounded: "14–20px (generously rounded)",
  pill: "fully rounded pill buttons, inputs and badges; ~20px on cards",
};

/** Renders a validated Style DNA into the same prompt-block format as the theme presets. */
export function styleDnaToPromptBlock(dna: StyleDna): string {
  return buildCustomThemePromptBlock({
    name: dna.name,
    description: dna.description.replace(/[.\s]+$/, ""),
    palette: dna.palette,
    fonts: dna.fonts,
    radius: RADIUS_GUIDANCE[dna.radius],
    vibe: dna.mood.replace(/[.\s]+$/, ""),
    tips: dna.tips.map((t) => t.replace(/[.\s]+$/, "")),
    sourceHost: dna.sourceHost,
  });
}

/**
 * Appends the design theme to a build prompt. A (re-validated) Style DNA wins over a preset id;
 * anything that fails validation is ignored rather than injected.
 */
export function appendDesignTheme(
  prompt: string,
  themeId: string | null | undefined,
  styleDna: StyleDna | null | undefined,
): string {
  if (styleDna) {
    const parsed = styleDnaSchema.safeParse(styleDna);
    if (parsed.success) return `${prompt}\n\n${styleDnaToPromptBlock(parsed.data)}`;
  }
  return appendThemeBlock(prompt, themeId);
}

/** Google Fonts stylesheet URL for previewing the given families (names must pass FONT_RE). */
export function googleFontsPreviewUrl(families: string[]): string | null {
  const unique = [...new Set(families.filter((f) => FONT_RE.test(f)))];
  if (unique.length === 0) return null;
  const params = unique.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

// ---------------------------------------------------------------------------------------------
// URL normalisation & SSRF validation (pure parts)
// ---------------------------------------------------------------------------------------------

export class StyleDnaUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StyleDnaUrlError";
  }
}

/** "stripe.com" → "https://stripe.com/". Returns null for anything that isn't a plausible web URL. */
export function normalizeUserUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048 || /\s/.test(trimmed)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    // "localhost:3000" / "example.com:8080" parse as a scheme; anything else (javascript:, file:) is rejected.
    if (!/^[a-z0-9.-]+:\d+/i.test(trimmed)) return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || (!url.hostname.includes(".") && !url.hostname.startsWith("["))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIPv4(o: number[]): boolean {
  const [a, b, c] = o;
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10/8 private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 192 && b === 0 && c === 0) || // 192.0.0/24 IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 88 && c === 99) || // 6to4 relay anycast
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast 224/4, reserved 240/4, broadcast
  );
}

/** Expands an IPv6 address to 8 16-bit groups; null when malformed. */
function parseIPv6(input: string): number[] | null {
  let ip = input;
  if (ip.includes("%")) return null; // zone ids (fe80::1%eth0) are never public
  // Embedded dotted IPv4 tail (::ffff:1.2.3.4)
  const lastColon = ip.lastIndexOf(":");
  const tail = ip.slice(lastColon + 1);
  let tailGroups: number[] = [];
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    tailGroups = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    ip = ip.slice(0, lastColon + 1) + "0:0"; // placeholder, replaced below
  }
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (all.length !== 8 || !all.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  const groups = all.map((g) => parseInt(g, 16));
  if (tailGroups.length === 2) {
    groups[6] = tailGroups[0];
    groups[7] = tailGroups[1];
  }
  return groups;
}

function v4FromGroups(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

function isBlockedIPv6(g: number[]): boolean {
  const first = g[0];
  if (g.slice(0, 5).every((x) => x === 0)) {
    // IPv4-mapped ::ffff:a.b.c.d → judge the embedded IPv4 address
    if (g[5] === 0xffff) return isBlockedIPv4(v4FromGroups(g[6], g[7]));
    return true; // ::, ::1, deprecated IPv4-compatible ::a.b.c.d and other reserved values
  }
  // NAT64 64:ff9b::/96 → embedded IPv4
  if (first === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(v4FromGroups(g[6], g[7]));
  }
  // Only global unicast 2000::/3 is allowed (blocks fc00::/7 ULA, fe80::/10 link-local,
  // fec0::/10 site-local, ff00::/8 multicast, 100::/64 discard, 64:ff9b:1::/48 local NAT64…)
  if ((first & 0xe000) !== 0x2000) return true;
  if (first === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (first === 0x2001 && g[1] < 0x0200) return true; // 2001::/23 IETF special (Teredo, ORCHID, etc.)
  if (first === 0x2002) return isBlockedIPv4(v4FromGroups(g[1], g[2])); // 6to4 embeds an IPv4
  return false;
}

/** True when an IP literal must not be fetched (private, loopback, link-local, metadata…) or is malformed. */
export function isBlockedIpAddress(address: string): boolean {
  const ip = address.trim().replace(/^\[|\]$/g, "");
  const v4 = parseIPv4(ip);
  if (v4) return isBlockedIPv4(v4);
  if (ip.includes(":")) {
    const v6 = parseIPv6(ip);
    return v6 ? isBlockedIPv6(v6) : true;
  }
  return true;
}

/** True when `host` is an IP literal (v4 or bracketed/unbracketed v6). */
export function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return parseIPv4(h) !== null || (h.includes(":") && parseIPv6(h) !== null);
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan", ".intranet", ".corp"];

/**
 * Validates a URL before ANY request (initial URL and every redirect hop): http/https only,
 * no credentials, default ports only, no internal hostnames, no blocked IP literals.
 * DNS results are checked separately at connect time (see the server fetcher).
 */
export function validateFetchUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  } catch {
    throw new StyleDnaUrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new StyleDnaUrlError("Only http and https URLs are supported.");
  }
  if (url.username || url.password) throw new StyleDnaUrlError("URLs with credentials aren't allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new StyleDnaUrlError("Only standard web ports (80/443) are allowed.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new StyleDnaUrlError("That URL has no host.");
  if (isIpLiteral(host)) {
    if (isBlockedIpAddress(host)) throw new StyleDnaUrlError("That address isn't publicly reachable.");
    return url;
  }
  if (
    host === "localhost" ||
    !host.includes(".") ||
    BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) ||
    host === "metadata.google.internal"
  ) {
    throw new StyleDnaUrlError("That address isn't publicly reachable.");
  }
  if (!HOST_RE.test(host)) throw new StyleDnaUrlError("That doesn't look like a valid website address.");
  return url;
}

// ---------------------------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------------------------

const toHex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0").toUpperCase();

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const s = raw.trim();
  if (s.endsWith("%")) return parseFloat(s) / 100;
  return parseFloat(s);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [conv(hh + 1 / 3) * 255, conv(hh) * 255, conv(hh - 1 / 3) * 255];
}

/** Converts #rgb/#rgba/#rrggbb/#rrggbbaa, rgb()/rgba() and hsl()/hsla() to "#RRGGBB". Transparent → null. */
export function normalizeColorToHex(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8) {
      if (parseInt(h.slice(6, 8), 16) === 0) return null;
      h = h.slice(0, 6);
    }
    return `#${h.toUpperCase()}`;
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(s);
  if (!fn) return null;
  const args = fn[2].replace(/\s*\/\s*/, " / ").split(/[\s,]+/).filter(Boolean);
  let alphaRaw: string | undefined;
  const slash = args.indexOf("/");
  const comps = slash >= 0 ? args.slice(0, slash) : args.slice(0, 3);
  if (slash >= 0) alphaRaw = args[slash + 1];
  else if (args.length >= 4) alphaRaw = args[3];
  if (comps.length !== 3 || comps.some((c) => c.includes("var(") || c === "none")) return null;
  const alpha = parseAlpha(alphaRaw);
  if (!Number.isFinite(alpha) || alpha <= 0.05) return null;

  if (fn[1].startsWith("rgb")) {
    const vals = comps.map((c) => (c.endsWith("%") ? (parseFloat(c) / 100) * 255 : parseFloat(c)));
    if (vals.some((v) => !Number.isFinite(v))) return null;
    return `#${vals.map(toHex2).join("")}`;
  }
  const h = parseFloat(comps[0].replace(/deg$/, "")) * (comps[0].endsWith("turn") ? 360 : 1);
  const sat = parseFloat(comps[1]) / 100;
  const light = parseFloat(comps[2]) / 100;
  if (![h, sat, light].every(Number.isFinite)) return null;
  return `#${hslToRgb(h, Math.min(1, Math.max(0, sat)), Math.min(1, Math.max(0, light))).map(toHex2).join("")}`;
}

const COLOR_TOKEN_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|(?:rgba?|hsla?)\([^()]*\)/g;

/** All colours mentioned in a CSS value (normalised hex, in order). */
export function extractColorsFromValue(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(COLOR_TOKEN_RE)) {
    const hexColor = normalizeColorToHex(m[0]);
    if (hexColor) out.push(hexColor);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// HTML & CSS parsing
// ---------------------------------------------------------------------------------------------

export type CssRule = { selector: string; declarations: Array<[string, string]> };

function parseDeclarations(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const part of body.split(";")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).replace(/!important\s*$/i, "").trim();
    if (!/^-{0,2}[a-z][a-z0-9_-]*$/i.test(prop) || !value) continue;
    out.push([prop.startsWith("--") ? part.slice(0, idx).trim() : prop, value]);
  }
  return out;
}

/** Innermost `selector { declarations }` blocks (works through @media/@supports nesting). */
export function parseCssRules(css: string): CssRule[] {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  const re = /([^{}]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const selector = m[1].replace(/^[\s\S]*;/, "").trim(); // drop preceding @import/@charset statements
    rules.push({ selector, declarations: parseDeclarations(m[2]) });
    if (rules.length > 20000) break;
  }
  return rules;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=<>"'/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const m of tag.matchAll(re)) {
    const key = m[1].toLowerCase();
    if (!(key in attrs)) attrs[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Families requested by a Google Fonts URL (css and css2 APIs). */
export function parseGoogleFontsHref(href: string): string[] {
  let url: URL;
  try {
    url = new URL(href, "https://fonts.googleapis.com/");
  } catch {
    return [];
  }
  if (url.hostname !== "fonts.googleapis.com") return [];
  const families: string[] = [];
  for (const value of url.searchParams.getAll("family")) {
    for (const fam of value.split("|")) {
      const name = fam.split(":")[0].replace(/\+/g, " ").trim();
      if (name && FONT_RE.test(name)) families.push(name);
    }
  }
  return [...new Set(families)];
}

export type ParsedHtml = {
  /** Contents of <style> blocks. */
  styleBlocks: string[];
  /** Contents of style="" attributes. */
  inlineStyles: string[];
  /** Absolute stylesheet URLs (excluding Google Fonts), in document order. */
  stylesheetUrls: string[];
  googleFontFamilies: string[];
  themeColor: string | null;
  title: string | null;
  description: string | null;
};

/** Regex-based extraction of style-relevant bits from an HTML document. */
export function parseHtmlForStyles(html: string, baseUrl: string): ParsedHtml {
  const doc = html.replace(/<!--[\s\S]*?-->/g, "");
  const styleBlocks = [...doc.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const withoutScripts = doc.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const inlineStyles = [...withoutScripts.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map((m) => decodeEntities(m[1] ?? m[2] ?? ""))
    .filter(Boolean)
    .slice(0, 3000);

  const stylesheetUrls: string[] = [];
  const googleFontFamilies: string[] = [];
  let themeColor: string | null = null;
  let description: string | null = null;

  for (const m of withoutScripts.matchAll(/<link\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
    const isStyle = rel.includes("stylesheet") || (rel.includes("preload") && (a.as ?? "").toLowerCase() === "style");
    if (!isStyle || !a.href) continue;
    let abs: string;
    try {
      abs = new URL(a.href, baseUrl).toString();
    } catch {
      continue;
    }
    if (/^https?:\/\/fonts\.googleapis\.com\//i.test(abs)) {
      googleFontFamilies.push(...parseGoogleFontsHref(abs));
    } else if (/^https?:/i.test(abs) && !stylesheetUrls.includes(abs)) {
      stylesheetUrls.push(abs);
    }
  }
  // @import of Google Fonts inside <style>
  for (const block of styleBlocks) {
    for (const m of block.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) {
      googleFontFamilies.push(...parseGoogleFontsHref(m[1]));
    }
  }

  for (const m of withoutScripts.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    const key = (a.name ?? a.property ?? "").toLowerCase();
    if (key === "theme-color" && !themeColor && a.content) themeColor = normalizeColorToHex(a.content);
    if ((key === "description" || key === "og:description") && !description && a.content) {
      description = a.content.replace(/\s+/g, " ").trim().slice(0, 240) || null;
    }
  }
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(withoutScripts);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim().slice(0, 140) || null : null;

  return {
    styleBlocks,
    inlineStyles,
    stylesheetUrls,
    googleFontFamilies: [...new Set(googleFontFamilies)],
    themeColor,
    title,
    description,
  };
}

// ---------------------------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------------------------

export type CssSignals = {
  /** Most used colours with weights (pure black/white down-weighted). */
  colors: Array<{ hex: string; weight: number }>;
  /** First background colour declared on html/body/:root. */
  pageBackground: string | null;
  /** First text colour declared on html/body/:root. */
  pageText: string | null;
  customProperties: Array<{ name: string; value: string }>;
  /** Primary font families by usage. */
  fontFamilies: Array<{ name: string; count: number }>;
  fontFaces: string[];
  /** Border radius values in px with counts (percent radii ignored). */
  radii: Array<{ px: number; count: number }>;
  boxShadowCount: number;
  /** max-width container sizes (px) with counts. */
  maxWidths: Array<{ px: number; count: number }>;
  declarationCount: number;
};

const GENERIC_FONTS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
  "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "inherit", "initial", "unset",
  "revert", "emoji", "math", "fangsong", "segoe ui", "helvetica neue", "arial", "helvetica", "roboto",
  "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji", "times new roman",
  "courier new", "menlo", "monaco", "consolas", "sfmono-regular", "liberation mono",
]);

/** First non-generic family in a font-family list ("Inter", sans-serif → "Inter"). */
export function primaryFontFamily(value: string): string | null {
  for (const raw of value.split(",")) {
    const name = raw.trim().replace(/^["']|["']$/g, "").trim();
    if (!name || name.startsWith("var(") || name.includes("(")) continue;
    if (GENERIC_FONTS.has(name.toLowerCase())) continue;
    return name.slice(0, 60);
  }
  return null;
}

function lengthToPx(value: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/i.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "px").toLowerCase();
  if (unit !== "px" && !m[2] && n !== 0) return null; // unitless non-zero isn't a length
  return unit === "px" ? n : n * 16;
}

const PAGE_SELECTOR_RE = /(^|,)\s*(html|body|:root)\s*(?=,|$)/i;

function bump<K>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topEntries<K>(map: Map<K, number>, n: number): Array<[K, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Aggregates design signals from stylesheet texts and inline style attributes. */
export function extractCssSignals(cssTexts: string[], inlineStyles: string[] = []): CssSignals {
  const rules: CssRule[] = cssTexts.flatMap((css) => parseCssRules(css));
  for (const style of inlineStyles) rules.push({ selector: "[style]", declarations: parseDeclarations(style) });

  const colorWeights = new Map<string, number>();
  const fonts = new Map<string, number>();
  const fontFaces = new Set<string>();
  const radii = new Map<number, number>();
  const maxWidths = new Map<number, number>();
  const customProps = new Map<string, string>();
  let boxShadowCount = 0;
  let pageBackground: string | null = null;
  let pageText: string | null = null;
  let declarationCount = 0;

  for (const rule of rules) {
    const isFontFace = rule.selector.toLowerCase().startsWith("@font-face");
    const isPage = PAGE_SELECTOR_RE.test(rule.selector);
    for (const [prop, value] of rule.declarations) {
      declarationCount++;
      if (isFontFace) {
        if (prop === "font-family") {
          const name = value.replace(/^["']|["']$/g, "").trim();
          if (name && name.length <= 60) fontFaces.add(name);
        }
        continue;
      }

      if (prop.startsWith("--")) {
        if (customProps.size < 400 && !customProps.has(prop)) customProps.set(prop, value.slice(0, 80));
      }

      const colors = extractColorsFromValue(value);
      for (const c of colors) {
        const neutral = c === "#000000" || c === "#FFFFFF";
        bump(colorWeights, c, neutral ? 0.25 : 1);
      }
      if (isPage) {
        if (!pageBackground && (prop === "background" || prop === "background-color") && colors[0]) {
          pageBackground = colors[0];
        }
        if (!pageText && prop === "color" && colors[0]) pageText = colors[0];
      }

      if (prop === "font-family") {
        const fam = primaryFontFamily(value);
        if (fam) bump(fonts, fam);
      } else if (prop === "font") {
        const m = /(?:^|\s)[\d.]+(?:px|rem|em|pt|%|vw|vh)(?:\s*\/\s*[\d.]+[a-z%]*)?\s+(.+)$/i.exec(value);
        const fam = m ? primaryFontFamily(m[1]) : null;
        if (fam) bump(fonts, fam);
      } else if (prop === "border-radius" || /^border-(?:top|bottom)-(?:left|right)-radius$/.test(prop)) {
        const first = value.split(/[\s/]+/)[0];
        const px = lengthToPx(first);
        if (px !== null && px >= 0) bump(radii, Math.min(Math.round(px), 9999));
      } else if (prop === "box-shadow") {
        if (!/^(none|initial|unset|inherit)$/i.test(value)) boxShadowCount++;
      } else if (prop === "max-width") {
        const px = lengthToPx(value);
        if (px !== null && px >= 480 && px <= 2400) bump(maxWidths, Math.round(px));
      }
    }
  }

  // Prefer design-token-looking custom properties (colour, font, radius, spacing, shadow).
  const tokenRe = /(color|colour|bg|background|surface|text|primary|secondary|accent|brand|font|radius|rounded|shadow|space|spacing|gap)/i;
  const customProperties = [...customProps.entries()]
    .filter(([name, value]) => tokenRe.test(name) || extractColorsFromValue(value).length > 0)
    .slice(0, 40)
    .map(([name, value]) => ({ name: name.slice(0, 60), value }));

  return {
    colors: topEntries(colorWeights, 16).map(([hexColor, weight]) => ({ hex: hexColor, weight: Math.round(weight * 100) / 100 })),
    pageBackground,
    pageText,
    customProperties,
    fontFamilies: topEntries(fonts, 8).map(([name, count]) => ({ name, count })),
    fontFaces: [...fontFaces].slice(0, 12),
    radii: topEntries(radii, 8).map(([px, count]) => ({ px, count })),
    boxShadowCount,
    maxWidths: topEntries(maxWidths, 5).map(([px, count]) => ({ px, count })),
    declarationCount,
  };
}

/** Heuristic radius feel from the most common radii (used as a hint for the model). */
export function classifyRadius(radii: Array<{ px: number; count: number }>): StyleDnaRadius | null {
  // `border-radius: 0` resets are everywhere; only let zeros count when there's little else.
  const nonZero = radii.filter((r) => r.px > 0);
  const nonZeroCount = nonZero.reduce((n, r) => n + r.count, 0);
  const meaningful = nonZeroCount >= 3 ? nonZero : radii.filter((r) => r.px > 0 || r.count > 2);
  if (meaningful.length === 0) return null;
  let pill = 0;
  let total = 0;
  const weighted: number[] = [];
  for (const r of meaningful) {
    total += r.count;
    if (r.px >= 999) pill += r.count;
    else for (let i = 0; i < Math.min(r.count, 200); i++) weighted.push(r.px);
  }
  if (pill / total > 0.35) return "pill";
  weighted.sort((a, b) => a - b);
  const median = weighted.length ? weighted[Math.floor(weighted.length / 2)] : 0;
  if (median <= 4) return "sharp";
  if (median <= 10) return "soft";
  return "rounded";
}

export type StyleSummaryInput = {
  host: string;
  html: ParsedHtml;
  signals: CssSignals;
  stylesheetsFetched: number;
};

/** Compact, bounded text summary of the extracted signals (this — not the page — goes to the model). */
export function buildStyleSummary({ host, html, signals, stylesheetsFetched }: StyleSummaryInput): string {
  const lines: string[] = [];
  lines.push(`Site host: ${host}`);
  if (html.title) lines.push(`Page title (untrusted, for mood only): ${html.title.slice(0, 120)}`);
  if (html.description) lines.push(`Meta description (untrusted, for mood only): ${html.description.slice(0, 200)}`);
  lines.push(`Stylesheets analysed: ${stylesheetsFetched} external + ${html.styleBlocks.length} inline blocks; ${signals.declarationCount} declarations.`);
  if (html.themeColor) lines.push(`theme-color meta: ${html.themeColor}`);
  if (signals.pageBackground) lines.push(`html/body background: ${signals.pageBackground}`);
  if (signals.pageText) lines.push(`html/body text colour: ${signals.pageText}`);
  if (signals.colors.length) {
    lines.push(`Colour frequency (hex:weight; pure black/white down-weighted): ${signals.colors.map((c) => `${c.hex}:${c.weight}`).join(", ")}`);
  }
  if (signals.customProperties.length) {
    lines.push(`CSS custom properties: ${signals.customProperties.slice(0, 30).map((p) => `${p.name}: ${p.value}`).join("; ").slice(0, 1400)}`);
  }
  if (signals.fontFamilies.length) {
    lines.push(`font-family usage: ${signals.fontFamilies.map((f) => `${f.name} (${f.count})`).join(", ")}`);
  }
  if (html.googleFontFamilies.length) lines.push(`Google Fonts loaded: ${html.googleFontFamilies.slice(0, 8).join(", ")}`);
  if (signals.fontFaces.length) lines.push(`@font-face families: ${signals.fontFaces.join(", ")}`);
  if (signals.radii.length) {
    lines.push(`border-radius (px:count): ${signals.radii.map((r) => `${r.px}:${r.count}`).join(", ")}`);
    const feel = classifyRadius(signals.radii);
    if (feel) lines.push(`Heuristic radius feel: ${feel}`);
  }
  lines.push(`box-shadow declarations: ${signals.boxShadowCount}`);
  if (signals.maxWidths.length) lines.push(`Container max-widths (px:count): ${signals.maxWidths.map((w) => `${w.px}:${w.count}`).join(", ")}`);
  return lines.join("\n").slice(0, 6000);
}
