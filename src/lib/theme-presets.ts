/**
 * Curated design themes the user can pick before building ("Lovable Themes"-style).
 * The client only sends a `themeId`; the server looks it up here and appends the prompt block,
 * so no arbitrary text can be injected through the theme selection.
 * Safe to import from both client and server code.
 */

export type ThemePalette = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
};

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  palette: ThemePalette;
  /** Google Fonts family names. */
  fonts: { display: string; body: string };
  /** CSS radius for cards/buttons, e.g. "12px". */
  radius: string;
  vibe: string;
  toPromptBlock: () => string;
};

type ThemeDefinition = Omit<ThemePreset, "toPromptBlock">;

const DEFINITIONS: ThemeDefinition[] = [
  {
    id: "midnight-neon",
    name: "Midnight Neon",
    description: "Dark, glowing cyberpunk with electric accents",
    palette: { bg: "#0B0B14", surface: "#151526", text: "#F2F3FF", muted: "#8A8CA8", primary: "#7C3AED", accent: "#22D3EE" },
    fonts: { display: "Space Grotesk", body: "Inter" },
    radius: "14px",
    vibe: "futuristic, high-contrast, neon glows and subtle gradients on a near-black background",
  },
  {
    id: "editorial-serif",
    name: "Editorial Serif",
    description: "Magazine-style typography with generous whitespace",
    palette: { bg: "#FAF8F3", surface: "#FFFFFF", text: "#1C1A17", muted: "#6B655C", primary: "#1C1A17", accent: "#B4442C" },
    fonts: { display: "Playfair Display", body: "Source Serif 4" },
    radius: "2px",
    vibe: "refined, literary, large serif headlines, thin rules, asymmetric editorial grids",
  },
  {
    id: "soft-pastel",
    name: "Soft Pastel",
    description: "Gentle pastels, rounded shapes, friendly and calm",
    palette: { bg: "#FDF7FB", surface: "#FFFFFF", text: "#2E2A3B", muted: "#8C86A0", primary: "#C084FC", accent: "#7DD3C0" },
    fonts: { display: "Quicksand", body: "Nunito" },
    radius: "20px",
    vibe: "soft, airy, dreamy, pastel blobs and gentle shadows",
  },
  {
    id: "brutalist-mono",
    name: "Brutalist Mono",
    description: "Raw black & white, heavy borders, monospace",
    palette: { bg: "#FFFFFF", surface: "#F2F2F2", text: "#000000", muted: "#555555", primary: "#000000", accent: "#FF3B00" },
    fonts: { display: "Archivo Black", body: "JetBrains Mono" },
    radius: "0px",
    vibe: "bold, raw, thick black borders, hard offset shadows, oversized type, no gradients",
  },
  {
    id: "luxury-gold",
    name: "Luxury Gold",
    description: "Black and gold, premium and elegant",
    palette: { bg: "#0E0D0B", surface: "#1A1814", text: "#F5EFE3", muted: "#A39A88", primary: "#C9A54C", accent: "#E8D6A8" },
    fonts: { display: "Cormorant Garamond", body: "Montserrat" },
    radius: "4px",
    vibe: "premium, understated luxury, thin gold lines, wide letter-spacing, slow elegant motion",
  },
  {
    id: "fresh-mint-saas",
    name: "Fresh Mint SaaS",
    description: "Clean modern SaaS with mint green highlights",
    palette: { bg: "#F7FBFA", surface: "#FFFFFF", text: "#0F1F1C", muted: "#5E716D", primary: "#10B981", accent: "#0EA5E9" },
    fonts: { display: "Plus Jakarta Sans", body: "Inter" },
    radius: "12px",
    vibe: "crisp, trustworthy, product-led, light cards with soft shadows and clear CTAs",
  },
  {
    id: "retro-arcade",
    name: "Retro Arcade",
    description: "8-bit nostalgia with pixel fonts and vivid colours",
    palette: { bg: "#1A1033", surface: "#2A1B4D", text: "#FFF6E0", muted: "#B9A7E0", primary: "#FF2E88", accent: "#FFD23F" },
    fonts: { display: "Press Start 2P", body: "VT323" },
    radius: "0px",
    vibe: "playful 80s arcade, pixel borders, scanlines, chunky buttons, CRT glow",
  },
  {
    id: "earthy-organic",
    name: "Earthy Organic",
    description: "Warm natural tones, handmade and sustainable feel",
    palette: { bg: "#F4EFE6", surface: "#FBF8F2", text: "#2F2A22", muted: "#7A6F5F", primary: "#6B7F4E", accent: "#C47A4A" },
    fonts: { display: "Fraunces", body: "Work Sans" },
    radius: "16px",
    vibe: "warm, natural, grounded, organic shapes, paper textures, botanical imagery",
  },
  {
    id: "corporate-clean",
    name: "Corporate Clean",
    description: "Professional blue, structured and trustworthy",
    palette: { bg: "#FFFFFF", surface: "#F5F7FA", text: "#111827", muted: "#6B7280", primary: "#1D4ED8", accent: "#0891B2" },
    fonts: { display: "IBM Plex Sans", body: "IBM Plex Sans" },
    radius: "8px",
    vibe: "professional, structured, data-friendly, clear hierarchy, restrained colour",
  },
  {
    id: "kids-playful",
    name: "Kids Playful",
    description: "Bright, bouncy colours and chunky rounded shapes",
    palette: { bg: "#FFF9E8", surface: "#FFFFFF", text: "#2B2B52", muted: "#7A7AA0", primary: "#FF6B6B", accent: "#4ECDC4" },
    fonts: { display: "Baloo 2", body: "Nunito" },
    radius: "24px",
    vibe: "joyful, bouncy animations, big rounded buttons, playful illustrations and stickers",
  },
];

function buildPromptBlock(t: ThemeDefinition): string {
  const p = t.palette;
  return [
    `DESIGN THEME (user-selected — follow it): "${t.name}" — ${t.description}.`,
    `Palette: background ${p.bg}, surface ${p.surface}, text ${p.text}, muted text ${p.muted}, primary ${p.primary}, accent ${p.accent}.`,
    `Fonts (Google Fonts): display/headings "${t.fonts.display}", body "${t.fonts.body}" — load them and use them consistently.`,
    `Radius: ${t.radius} for cards, inputs and buttons.`,
    `Mood: ${t.vibe}.`,
  ].join("\n");
}

export const THEME_PRESETS: ThemePreset[] = DEFINITIONS.map((def) => ({
  ...def,
  toPromptBlock: () => buildPromptBlock(def),
}));

export function getThemePreset(id: string | null | undefined): ThemePreset | undefined {
  if (!id) return undefined;
  return THEME_PRESETS.find((t) => t.id === id);
}

/**
 * A custom (non-preset) theme, e.g. one extracted by Style DNA. Every field MUST already be
 * validated (hex colours, safe font names, short single-line text) before it reaches this helper.
 */
export type CustomThemeDefinition = {
  name: string;
  description: string;
  palette: ThemePalette;
  fonts: { display: string; body: string };
  /** Human-readable radius guidance, e.g. "12–16px (rounded)". */
  radius: string;
  vibe: string;
  /** Optional short layout/style traits. */
  tips?: string[];
  /** Hostname the style was taken from (adds a "do not copy content" guard). */
  sourceHost?: string;
};

/** Renders a validated custom theme in the same prompt-block format as the presets. */
export function buildCustomThemePromptBlock(theme: CustomThemeDefinition): string {
  const lines = buildPromptBlock({ id: "custom", ...theme }).split("\n");
  if (theme.tips && theme.tips.length > 0) {
    lines.push(`Style traits: ${theme.tips.join("; ")}.`);
  }
  if (theme.sourceHost) {
    lines.push(
      `This theme is inspired by the visual style of ${theme.sourceHost}; do NOT copy its text, images, logos or layout verbatim — create original content that only shares the look and feel.`,
    );
  }
  return lines.join("\n");
}

/** Appends the selected theme's prompt block; unknown/empty ids leave the prompt unchanged. */
export function appendThemeBlock(prompt: string, themeId: string | null | undefined): string {
  const theme = getThemePreset(themeId);
  return theme ? `${prompt}\n\n${theme.toPromptBlock()}` : prompt;
}
