import { z } from "zod";
import { meteredOpenAIFetch, TOKEN_ESTIMATES } from "@/lib/token-budget";
import { logOpenAIError } from "@/lib/openai-errors";

/**
 * Image / screenshot / sketch → app.
 *
 * The user can attach up to 3 reference images to a build request. Before the build event is sent,
 * one vision call turns them into a precise written "build brief" that is appended to the prompt the
 * agent receives. The images themselves are never stored or forwarded to Inngest.
 */

export const MAX_ATTACHED_IMAGES = 3;
/** Max length of one data URL string (≈ 2.1 MB of binary after base64). */
export const MAX_IMAGE_DATA_URL_LENGTH = 2_800_000;

const DATA_URL_RE = /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Strict validator for the optional `images` input on build mutations. */
export const imagesInputSchema = z
  .array(
    z
      .string()
      .max(MAX_IMAGE_DATA_URL_LENGTH, { message: "Attached image is too large (max ~2MB)" })
      .regex(DATA_URL_RE, { message: "Attached images must be PNG, JPEG or WebP data URLs" }),
  )
  .max(MAX_ATTACHED_IMAGES, { message: `You can attach up to ${MAX_ATTACHED_IMAGES} images` })
  .optional();

type ResponsesApiResult = {
  output_text?: unknown;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }>;
};

const BRIEF_TIMEOUT_MS = 45_000;

const BRIEF_INSTRUCTIONS = `You are a senior product designer writing a build brief for an AI that will recreate the attached image(s) as a working website/app. Be precise and exhaustive; the builder cannot see the images.

Write the brief in plain text with these sections:
1. TYPE & PURPOSE: what kind of page/app/screen this is.
2. LAYOUT (top → bottom): every region in order (nav, hero, sections, sidebars, footer…), with column structure, alignment and approximate proportions.
3. COMPONENTS: every visible section/component and its contents (cards, forms, tables, charts, lists, buttons, badges, tabs…).
4. TEXT CONTENT: transcribe all visible text exactly (headings, labels, buttons, body copy, numbers). Mark illegible text as [illegible].
5. COLOUR PALETTE: background, surfaces, text, primary, accent, borders, states — with hex values (best estimate).
6. TYPOGRAPHY: font style (serif/sans/mono, likely Google Font match), weights and approximate sizes per text level.
7. SPACING & SHAPE: spacing rhythm, border radius, borders, shadows, gradients, glassmorphism etc.
8. IMAGERY & ICONS: photos/illustrations (describe subject so a matching stock image can be chosen), icon style and which icons.
9. INTERACTIONS: interactive elements and their likely behaviour (navigation, hover, toggles, modals, form submission, filtering…).
10. If the image is a hand-drawn sketch or low-fidelity wireframe: explain how to turn it into a polished, modern design (suggest palette, type and styling) while keeping its structure.
If several images are attached, describe each one (Image 1, Image 2, …) and say how they relate (e.g. different screens/pages of the same app).
Do not write code. Do not add commentary outside the brief.`;

/**
 * One OpenAI Responses API call that converts the reference images into a written build brief.
 * Throws on any failure (missing key, HTTP error, timeout, empty output).
 */
export async function generateImageBrief(images: string[], userText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (images.length === 0) throw new Error("No images provided");

  const model = process.env.VISION_MODEL || "gpt-6.1-terra";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIEF_TIMEOUT_MS);

  try {
    const res = await meteredOpenAIFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: BRIEF_INSTRUCTIONS,
        reasoning: { effort: "low" },
        max_output_tokens: 1800,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `The user attached ${images.length} reference image(s) with this request:\n"""\n${userText.slice(0, 4000)}\n"""\nWrite the build brief for the attached image(s).`,
              },
              ...images.map((url) => ({ type: "input_image", image_url: url, detail: "high" })),
            ],
          },
        ],
      }),
    }, TOKEN_ESTIMATES.vision);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      let parsed: unknown = null;
      try { parsed = JSON.parse(detail); } catch { /* not JSON */ }
      logOpenAIError("image-brief", res.status, (parsed as Parameters<typeof logOpenAIError>[2]) ?? { error: { message: detail.slice(0, 300) } });
      throw new Error(`Vision request failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as ResponsesApiResult;
    let text = typeof data.output_text === "string" ? data.output_text : "";
    if (!text && Array.isArray(data.output)) {
      text = data.output
        .filter((item) => item?.type === "message" && Array.isArray(item.content))
        .flatMap((item) => item.content ?? [])
        .filter((c) => c?.type === "output_text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("\n");
    }
    text = text.trim();
    if (!text) throw new Error("Vision model returned an empty brief");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Never throws: returns the brief, or null when there are no images or the call failed
 * (the build continues without it).
 */
export async function resolveImageBrief(images: string[] | undefined, userText: string): Promise<string | null> {
  if (!images || images.length === 0) return null;
  try {
    return await generateImageBrief(images, userText);
  } catch (error) {
    console.warn("[image-brief] Could not generate image brief; continuing without it:", error);
    return null;
  }
}

/** Appends the brief to the prompt sent to the build agent. */
export function appendImageBrief(prompt: string, brief: string | null, imageCount: number): string {
  if (!brief) return prompt;
  return `${prompt}\n\n---\nREFERENCE IMAGE BRIEF (the user attached ${imageCount} image(s); reproduce this design faithfully unless the request says otherwise):\n${brief}`;
}

/** Short marker appended to the saved USER message (the images themselves are not stored). */
export function withImageMarker(text: string, imageCount: number): string {
  return imageCount > 0 ? `${text}\n\n📎 ${imageCount} image(s) attached` : text;
}
