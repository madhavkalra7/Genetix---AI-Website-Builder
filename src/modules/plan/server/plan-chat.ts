import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatKnowledgeBlock, loadProjectKnowledge } from "@/lib/knowledge";
import { meteredOpenAIFetch, TOKEN_ESTIMATES, isDailyLimitResponse } from "@/lib/token-budget";
import { aiProblemUserMessage, logOpenAIError } from "@/lib/openai-errors";

/**
 * "Plan / Chat" mode: one cheap chat completion (no agents, no sandbox, no credits) that helps
 * the user figure out what to build. Plan messages are stored as normal project messages
 * (ASSISTANT + RESULT, no fragment), so the builder later receives them as conversation context.
 */

export const PLAN_RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 } as const;
const HISTORY_LIMIT = 20;
const MAX_HISTORY_CHARS = 2000;

export const PLAN_SYSTEM_PROMPT = `You are Genetix, a friendly senior product designer and engineer. You help the user plan what to build before an AI builder creates it. Projects can be anything: games, tools, apps, dashboards, websites.

In each reply:
1. Briefly reflect (1-2 sentences) what you understood so far.
2. Ask 2-4 specific clarifying questions as a short numbered list - only the questions whose answers would most change the result (e.g. audience, core features or game mechanics, style/vibe, content, must-haves). Don't re-ask things already answered.
3. Optionally suggest 2-3 concrete ideas that would make it great.
4. Once enough is known (or the user asks for it), give a concise **Plan**: type of project, screens/sections, key features, visual direction - then tell them they can press "Build this" to build it.

Rules: never write code. Keep replies short (under ~180 words). Use plain markdown only: short paragraphs, numbered or bulleted lists, **bold**. No headings larger than bold text, no tables, no code blocks.`;

type HistoryMessage = { role: "USER" | "ASSISTANT"; content: string };

/** Throws TOO_MANY_REQUESTS when the user is chatting in plan mode too quickly. */
export async function enforcePlanRateLimit(userId: string): Promise<void> {
  const result = await checkRateLimit(`plan:${userId}`, PLAN_RATE_LIMIT.limit, PLAN_RATE_LIMIT.windowMs);
  if (!result.ok) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You're chatting a bit fast - try again in ${result.retryAfterSec} seconds.`,
    });
  }
}

const clip = (s: string) => (s.length > MAX_HISTORY_CHARS ? `${s.slice(0, MAX_HISTORY_CHARS)}…` : s);

/** Calls OpenAI Chat Completions and returns the plan reply text. Throws a friendly TRPCError on failure. */
export async function generatePlanReply(opts: {
  history: HistoryMessage[];
  message: string;
  techStack?: string | null;
  /** Pre-formatted Knowledge block (brand/rules) the plan should respect */
  knowledge?: string | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[plan] OPENAI_API_KEY is not configured");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Planning is unavailable right now. Please try again later." });
  }
  const model = process.env.PLAN_MODEL || "gpt-6.1-terra";

  const baseSystem = opts.techStack
    ? `${PLAN_SYSTEM_PROMPT}\n\nThe project will be built with the "${opts.techStack}" tech stack; don't ask about technology.`
    : PLAN_SYSTEM_PROMPT;
  // Knowledge: plan within the user's standing rules and don't re-ask what they already answer
  const system = opts.knowledge
    ? `${baseSystem}\n\nThe user has defined these standing instructions — respect them and don't ask about what they already answer:\n${opts.knowledge}`
    : baseSystem;

  const messages = [
    { role: "system", content: system },
    ...opts.history.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: clip(m.content),
    })),
    { role: "user", content: opts.message },
  ];

  let reply = "";
  try {
    const res = await meteredOpenAIFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        // gpt-6 / reasoning models: reasoning_effort + max_completion_tokens (temperature unsupported).
        ...(/^(gpt-6|gpt-5|o\d)/.test(model) ? { reasoning_effort: "low" } : { temperature: 0.6 }),
        max_completion_tokens: 1200,
      }),
    }, TOKEN_ESTIMATES.chat);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (isDailyLimitResponse(res.status, err)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: err.error.message });
      }
      const kind = logOpenAIError("plan-chat", res.status, err);
      if (kind !== "other" && kind !== "server") {
        throw new TRPCError({ code: kind === "rate" ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE", message: aiProblemUserMessage(kind) });
      }
    } else {
      const data = await res.json();
      reply = String(data?.choices?.[0]?.message?.content || "").trim();
    }
  } catch (e) {
    if (e instanceof TRPCError) throw e; // e.g. daily AI limit reached — show that message
    console.error("[plan] request failed:", e instanceof Error ? e.message : e);
  }

  if (!reply) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Genetix couldn't reply right now. Please try again in a moment.",
    });
  }
  return reply;
}

/**
 * Full plan-chat turn for an existing project: ownership check, rate limit, load recent history,
 * generate the reply, then save the USER + ASSISTANT messages together. Returns the assistant message.
 */
export async function runPlanChat(opts: { projectId: string; userId: string; message: string }) {
  const project = await prisma.project.findFirst({
    where: { id: opts.projectId, userId: opts.userId },
    select: { id: true, techStack: true },
  });
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }

  await enforcePlanRateLimit(opts.userId);

  const recent = await prisma.message.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  const history: HistoryMessage[] = recent
    .reverse()
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  const knowledge = formatKnowledgeBlock(await loadProjectKnowledge(opts.projectId));
  const reply = await generatePlanReply({ history, message: opts.message, techStack: project.techStack, knowledge });

  // Explicit, strictly increasing timestamps so the pair always sorts user -> assistant.
  const now = Date.now();
  const userAt = new Date(now);
  const assistantAt = new Date(now + 1);

  const [, assistantMessage] = await prisma.$transaction([
    prisma.message.create({
      data: {
        projectId: project.id,
        role: "USER",
        type: "RESULT",
        content: opts.message,
        createdAt: userAt,
        updatedAt: userAt,
      },
    }),
    prisma.message.create({
      data: {
        projectId: project.id,
        role: "ASSISTANT",
        type: "RESULT",
        content: reply,
        createdAt: assistantAt,
        updatedAt: assistantAt,
      },
    }),
    prisma.project.update({ where: { id: project.id }, data: { updatedAt: assistantAt } }),
  ]);

  return assistantMessage;
}
