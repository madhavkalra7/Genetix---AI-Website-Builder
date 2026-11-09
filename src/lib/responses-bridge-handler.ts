// Shared handler for the Chat Completions -> Responses API bridge routes.
// Optional buildId (from the per-build URL) enables usage tracking + a per-build token budget.

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { chatToResponsesRequest, responsesToChatResponse } from "@/lib/responses-bridge";
import { BUILD_TOKEN_BUDGET, getBuildTokenTotal, recordBuildUsage } from "@/lib/build-tracker";
import { recordDailyTokens, remainingDailyTokens } from "@/lib/token-budget";
import { logOpenAIError } from "@/lib/openai-errors";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.OPENAI_API_KEY;
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const BUDGET_MESSAGE =
  "SYSTEM NOTICE: the token budget for this build is used up. Do not call any more tools. " +
  "Reply now with your final summary in the required tag (<task_summary> or <review_summary>), describing what is complete.";

export async function handleBridgeRequest(req: NextRequest, buildId?: string) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const responsesBody = chatToResponsesRequest(body);

  // Prompt caching: requests sharing a long system prompt get routed together.
  const firstInput = Array.isArray(responsesBody.input) ? responsesBody.input[0] : null;
  const systemText = typeof firstInput?.content === "string" ? firstInput.content : "";
  if (systemText) {
    responsesBody.prompt_cache_key = "gx-" + createHash("sha256").update(String(responsesBody.model) + systemText).digest("hex").slice(0, 24);
  }

  // Per-build token budget OR today's daily OpenAI limit: once exceeded, force the agent to wrap
  // up (no more tool calls) so the build still saves what it has.
  const dailyExceeded = (await remainingDailyTokens(String(responsesBody.model))) <= 0;
  if (buildId || dailyExceeded) {
    const used = buildId ? await getBuildTokenTotal(buildId).catch(() => 0) : 0;
    if (used >= BUILD_TOKEN_BUDGET || dailyExceeded) {
      console.warn(`💸 ${dailyExceeded ? "Daily token limit reached" : `Build ${buildId} hit its token budget (${used}/${BUILD_TOKEN_BUDGET})`}; forcing wrap-up`);
      responsesBody.input = [...(responsesBody.input || []), { role: "developer", content: BUDGET_MESSAGE }];
      if (responsesBody.tools) responsesBody.tool_choice = "none";
    }
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(responsesBody),
  });

  const data = await upstream.json().catch(() => null);

  if (!upstream.ok || !data || data.error) {
    logOpenAIError(`builder bridge${buildId ? ` (build ${buildId})` : ""}`, upstream.status, data?.error ? data : { error: { message: JSON.stringify(data).slice(0, 300) } });
    return NextResponse.json(
      { error: data?.error ?? { message: `OpenAI Responses API failed (HTTP ${upstream.status})` } },
      { status: upstream.ok ? 502 : upstream.status }
    );
  }

  const chat = responsesToChatResponse(data);
  const usage = {
    input: data.usage?.input_tokens ?? 0,
    cached: data.usage?.input_tokens_details?.cached_tokens ?? 0,
    output: data.usage?.output_tokens ?? 0,
    reasoning: data.usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };
  if (buildId) await recordBuildUsage(buildId, usage);
  await recordDailyTokens(data.model ?? String(responsesBody.model), usage.input + usage.output);

  console.log(
    `🧠 Responses bridge${buildId ? ` [${buildId}]` : ""}: ${data.model} effort=${responsesBody.reasoning?.effort ?? "none"} ` +
      `in=${usage.input} (cached ${usage.cached}) out=${usage.output} reasoning=${usage.reasoning}`
  );
  return NextResponse.json(chat);
}
