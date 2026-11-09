// Project naming: an AI-generated, specific name at creation time, with a fast
// keyword-based fallback. (Naming happens BEFORE the build so users see a good name
// immediately, and a later automatic rename can never overwrite a name they edited.)

const NAME_TIMEOUT_MS = 6000;
const MAX_NAME_LENGTH = 60;

const COMMON_WORDS = new Set([
  "create", "build", "make", "design", "designed", "develop", "generate", "a", "an", "the", "my", "new",
  "modern", "simple", "basic", "advanced", "with", "for", "and", "or", "but", "website", "web", "site",
  "app", "apps", "application", "page", "use", "using", "search", "please", "want", "need", "can", "you",
  "could", "would", "should", "like", "some", "that", "this", "just", "also", "real", "proper", "good",
  "best", "nice", "cool", "beautiful", "awesome", "give", "help", "write", "code", "fully", "full",
  "functional", "responsive", "are", "its", "into", "from", "all", "very", "then", "which", "one", "have",
  "has", "will", "feature", "features", "android", "ios", "mobile", "iphone", "native", "pwa", "ui", "ux",
  "complete", "working", "production", "ready", "level", "professional", "premium", "stunning", "clean",
  "minimal", "minimalist", "dark", "light", "theme", "mode", "type", "kind", "something", "thing", "about",
  "where", "what", "how", "when", "who", "well", "style", "styled", "type", "your", "our", "their", "them", "there", "here", "more", "most",
]);

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Keyword fallback, e.g. "use web search and create a habit tracker app" -> "Habit Tracker". */
export function fallbackProjectName(prompt: string, kind: "web" | "app" = "web"): string {
  const cleaned = prompt
    .toLowerCase()
    .replace(/\b(use|using|with|via|do|perform)\s+(a\s+)?(web|internet|google|online)\s+search(es|ing)?\b/g, " ")
    .replace(/\b(search|look up|research)\s+(the\s+)?(web|internet|online)\b/g, " ");
  const words = cleaned
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMMON_WORDS.has(w));
  if (words.length === 0) return kind === "app" ? "Mobile App" : "Web Project";
  if (words.length === 1) return `${capitalize(words[0])} ${kind === "app" ? "App" : "Site"}`;
  return `${capitalize(words[0])} ${capitalize(words[1])}`;
}

/** Normalise any name (AI or user supplied) to a clean single line of max 60 chars. */
export function sanitizeProjectName(raw: string): string {
  return raw
    .replace(/^\s*(title|name|project name)\s*:\s*/i, "")
    .replace(/["'`*_#<>]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

/** AI-generated 2-4 word name describing WHAT is being built; falls back to keywords on any problem. */
export async function generateProjectName(prompt: string, kind: "web" | "app" = "web"): Promise<string> {
  const fallback = fallbackProjectName(prompt, kind);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !prompt.trim()) return fallback;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAME_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.NAMING_MODEL || "gpt-6.1-terra",
        reasoning_effort: "none",
        max_completion_tokens: 30,
        messages: [
          {
            role: "system",
            content:
              `You name ${kind === "app" ? "mobile app" : "web"} projects. Reply with ONLY a short, specific project name of 2 to 4 words in Title Case that says WHAT is being built ` +
              `(its subject/product, e.g. "Habit Streak Tracker", "Pune Bakery Site", "Asteroid Dodge Shooter", "Kids Animal Memory Game"). ` +
              `Ignore instruction words (use web search, create, build, make, proper, real, full, android, ios, designed). ` +
              `Keep real brand/person/place names from the request. No quotes, no punctuation, no emojis.`,
          },
          { role: "user", content: prompt.slice(0, 2000) },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const name = sanitizeProjectName(String(data?.choices?.[0]?.message?.content ?? ""));
    const wordCount = name.split(" ").filter(Boolean).length;
    return name && wordCount >= 1 && wordCount <= 6 ? name : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
