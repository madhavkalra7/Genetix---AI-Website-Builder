// Turn OpenAI failures into (1) one clear server log line that says WHAT is wrong and HOW to fix
// it, and (2) a friendly message for users instead of a generic "please try again".

export type OpenAIProblem = "daily" | "quota" | "auth" | "model" | "rate" | "server" | "other";

type ErrorBody = { error?: { message?: string; type?: string; code?: string | null } | string | null } | null | undefined;

const FIX: Record<OpenAIProblem, string> = {
  daily: "Genetix's own daily token meter paused AI work; it resets at 00:00 UTC (DAILY_TOKEN_LIMIT_* env vars).",
  quota: "OpenAI refused for billing: raise the spend limit at https://platform.openai.com/settings/organization/limits or add credits at https://platform.openai.com/settings/organization/billing.",
  auth: "OPENAI_API_KEY is missing, wrong or revoked: update it in the Vercel env vars and redeploy.",
  model: "This API key can't use the requested model: check the model name / project model access.",
  rate: "OpenAI rate limit (requests or tokens per minute): retry shortly or raise the tier.",
  server: "OpenAI had a server error: usually temporary.",
  other: "Unexpected OpenAI error.",
};

const USER_MESSAGE: Record<Exclude<OpenAIProblem, "daily">, string> = {
  quota: "Genetix's AI is temporarily unavailable (usage limit reached). Please try again later.",
  auth: "Genetix's AI is temporarily unavailable. Please try again later.",
  model: "Genetix's AI is temporarily unavailable. Please try again later.",
  rate: "Genetix is very busy right now. Please try again in a minute.",
  server: "Genetix's AI had a hiccup. Please try again in a moment.",
  other: "Genetix couldn't do that right now. Please try again in a moment.",
};

function errorParts(body: ErrorBody): { message: string; type: string; code: string } {
  const e = body?.error;
  if (typeof e === "string") return { message: e, type: "", code: "" };
  return { message: e?.message ?? "", type: e?.type ?? "", code: e?.code ?? "" };
}

/** Classify free text (e.g. a thrown error's message) that may contain an OpenAI error. */
export function classifyErrorText(text: string | null | undefined): OpenAIProblem | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("daily_token_limit") || t.includes("reached today's ai limit")) return "daily";
  if (/insufficient_quota|spend.?limit|exceeded your current quota|billing_hard_limit|billing/.test(t)) return "quota";
  if (/invalid_api_key|incorrect api key|401|unauthorized|no api key/.test(t)) return "auth";
  if (/model_not_found|does not exist or you do not have access|unsupported model/.test(t)) return "model";
  if (/rate_limit_exceeded|rate limit|too many requests|\b429\b/.test(t)) return "rate";
  if (/\b50[0-4]\b|server_error|overloaded|bad gateway/.test(t)) return "server";
  return null;
}

/** Classify an OpenAI HTTP error response. */
export function classifyOpenAIError(status: number, body: ErrorBody): OpenAIProblem {
  const { message, type, code } = errorParts(body);
  const fromText = classifyErrorText(`${code} ${type} ${message}`);
  if (fromText) return fromText;
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model";
  if (status === 429) return "rate";
  if (status >= 500) return "server";
  return "other";
}

/** Friendly user-facing message. Daily-meter errors keep their own (reset time) message. */
export function aiProblemUserMessage(kind: OpenAIProblem, original?: string): string {
  if (kind === "daily") return original || "Genetix has reached today's AI limit. Please try again after 5:30 AM IST.";
  return USER_MESSAGE[kind];
}

/** One structured log line with the real reason + fix. Returns the classification. */
export function logOpenAIError(where: string, status: number, body: ErrorBody): OpenAIProblem {
  const kind = classifyOpenAIError(status, body);
  const { message, type, code } = errorParts(body);
  const tag = [type, code].filter(Boolean).join("/") || "no-code";
  console.error(`🚫 [openai:${kind}] ${where}: HTTP ${status} ${tag} — ${message.slice(0, 300) || "(no message)"} → ${FIX[kind]}`);
  return kind;
}

/** For failures known only by a thrown error message (e.g. Inngest onFailure). */
export function userMessageForFailure(errorMessage: string | null | undefined, fallback: string): string {
  const kind = classifyErrorText(errorMessage);
  if (!kind || kind === "server") return fallback;
  return `${aiProblemUserMessage(kind)} No credits were used.`;
}
