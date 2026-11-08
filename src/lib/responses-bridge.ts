// Translates between OpenAI Chat Completions format (what @inngest/agent-kit speaks)
// and the OpenAI Responses API (required for reasoning + function tools on gpt-6 models).

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReasoningEffort = "low" | "medium";

/**
 * Fixed reasoning effort per build mode (not user-configurable):
 * - Advanced Reasoning (gpt-6-sol): medium
 * - Simple & Fast (any tech stack) and App builder (gpt-6-luna): low
 */
export function getReasoningEffort(opts: { isApp: boolean; advancedReasoning: boolean }): ReasoningEffort {
  if (!opts.isApp && opts.advancedReasoning) return "medium";
  return "low";
}

/** Public base URL of this app, used so Inngest can reach the bridge route. */
export function getResponsesBridgeBaseUrl(): string | null {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/api/ai/responses-bridge/`;
}

/** Chat Completions request body -> Responses API request body */
export function chatToResponsesRequest(body: any): any {
  const input: any[] = [];

  for (const m of body.messages ?? []) {
    if (m.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: m.tool_call_id,
        output: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
      });
      continue;
    }
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      if (typeof m.content === "string" && m.content.trim()) {
        input.push({ role: "assistant", content: m.content });
      }
      for (const tc of m.tool_calls) {
        input.push({
          type: "function_call",
          call_id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments ?? "{}",
        });
      }
      continue;
    }
    const content =
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map((p: any) => p?.text ?? "").join("")
          : String(m.content ?? "");
    if (!content.trim()) continue;
    input.push({ role: m.role === "system" ? "developer" : m.role, content });
  }

  const req: any = {
    model: body.model,
    input,
    store: false,
  };

  const effort = body.reasoning_effort ?? body.reasoning?.effort;
  if (effort) req.reasoning = { effort };
  // Sampling params are rejected by reasoning models when reasoning is active.
  if ((!effort || effort === "none") && typeof body.temperature === "number") {
    req.temperature = body.temperature;
  }

  const maxTokens = body.max_completion_tokens ?? body.max_tokens;
  if (typeof maxTokens === "number") req.max_output_tokens = maxTokens;

  if (Array.isArray(body.tools) && body.tools.length) {
    req.tools = body.tools.map((t: any) => {
      const params = t.function?.parameters ? { ...t.function.parameters } : undefined;
      if (params) delete params.$schema;
      return {
        type: "function",
        name: t.function?.name,
        description: t.function?.description,
        parameters: params ?? { type: "object", properties: {} },
        strict: t.function?.strict ?? false,
      };
    });
    if (typeof body.parallel_tool_calls === "boolean") req.parallel_tool_calls = body.parallel_tool_calls;
    if (body.tool_choice) {
      req.tool_choice =
        typeof body.tool_choice === "string"
          ? body.tool_choice
          : { type: "function", name: body.tool_choice.function?.name };
    }
  }

  return req;
}

/** Responses API response -> Chat Completions response */
export function responsesToChatResponse(res: any): any {
  const output: any[] = Array.isArray(res.output) ? res.output : [];

  const text = output
    .filter((o) => o.type === "message")
    .flatMap((o) => (Array.isArray(o.content) ? o.content : []))
    .filter((c: any) => c.type === "output_text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("");

  const toolCalls = output
    .filter((o) => o.type === "function_call")
    .map((o) => ({
      id: o.call_id,
      type: "function",
      function: { name: o.name, arguments: o.arguments ?? "{}" },
    }));

  const finishReason = toolCalls.length
    ? "tool_calls"
    : res.status === "incomplete" && res.incomplete_details?.reason === "max_output_tokens"
      ? "length"
      : "stop";

  const message: any = { role: "assistant", content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;

  return {
    id: res.id,
    object: "chat.completion",
    created: res.created_at ?? Math.floor(Date.now() / 1000),
    model: res.model,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: {
      prompt_tokens: res.usage?.input_tokens ?? 0,
      completion_tokens: res.usage?.output_tokens ?? 0,
      total_tokens: res.usage?.total_tokens ?? 0,
      completion_tokens_details: {
        reasoning_tokens: res.usage?.output_tokens_details?.reasoning_tokens ?? 0,
      },
    },
  };
}
