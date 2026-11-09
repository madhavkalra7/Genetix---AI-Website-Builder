import { describe, expect, it } from "vitest";
import { chatToResponsesRequest, getReasoningEffort, responsesToChatResponse } from "@/lib/responses-bridge";

const chatBody = {
  model: "gpt-6.1-terra",
  reasoning_effort: "low",
  temperature: 0.2,
  max_completion_tokens: 4000,
  parallel_tool_calls: false,
  tool_choice: "auto",
  tools: [
    {
      type: "function",
      function: {
        name: "createOrUpdateFiles",
        description: "Write files",
        parameters: { $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: { files: { type: "array" } } },
      },
    },
  ],
  messages: [
    { role: "system", content: "You are a builder." },
    { role: "user", content: [{ type: "text", text: "Build " }, { type: "text", text: "a todo app" }] },
    {
      role: "assistant",
      content: "Writing files now.",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "createOrUpdateFiles", arguments: '{"files":[]}' } }],
    },
    { role: "tool", tool_call_id: "call_1", content: { ok: true } },
    { role: "user", content: "   " },
  ],
};

describe("chatToResponsesRequest", () => {
  const req = chatToResponsesRequest(chatBody);

  it("maps messages, tool calls and tool results to Responses input items", () => {
    expect(req.input).toEqual([
      { role: "developer", content: "You are a builder." },
      { role: "user", content: "Build a todo app" },
      { role: "assistant", content: "Writing files now." },
      { type: "function_call", call_id: "call_1", name: "createOrUpdateFiles", arguments: '{"files":[]}' },
      { type: "function_call_output", call_id: "call_1", output: '{"ok":true}' },
    ]);
  });

  it("sets reasoning effort and drops temperature when reasoning", () => {
    expect(req.reasoning).toEqual({ effort: "low" });
    expect(req).not.toHaveProperty("temperature");
    expect(req.max_output_tokens).toBe(4000);
    expect(req.store).toBe(false);
    expect(req.model).toBe("gpt-6.1-terra");
  });

  it("keeps temperature without reasoning or with effort none", () => {
    const { reasoning_effort: _ignored, ...noReasoning } = chatBody;
    void _ignored;
    expect(chatToResponsesRequest(noReasoning).temperature).toBe(0.2);
    expect(chatToResponsesRequest({ ...chatBody, reasoning_effort: "none" }).temperature).toBe(0.2);
    expect(chatToResponsesRequest({ ...noReasoning, reasoning: { effort: "medium" } }).reasoning).toEqual({ effort: "medium" });
  });

  it("converts tools (flattened, $schema removed) and tool options", () => {
    expect(req.tools).toEqual([
      {
        type: "function",
        name: "createOrUpdateFiles",
        description: "Write files",
        parameters: { type: "object", properties: { files: { type: "array" } } },
        strict: false,
      },
    ]);
    expect(req.parallel_tool_calls).toBe(false);
    expect(req.tool_choice).toBe("auto");
    // original body is not mutated
    expect(chatBody.tools[0].function.parameters).toHaveProperty("$schema");
  });

  it("maps a forced function tool_choice", () => {
    const forced = chatToResponsesRequest({ ...chatBody, tool_choice: { type: "function", function: { name: "terminal" } } });
    expect(forced.tool_choice).toEqual({ type: "function", name: "terminal" });
  });
});

describe("responsesToChatResponse", () => {
  it("converts tool calls and usage", () => {
    const chat = responsesToChatResponse({
      id: "resp_1",
      created_at: 123,
      model: "gpt-6.1-terra",
      status: "completed",
      output: [
        { type: "reasoning", summary: [] },
        { type: "message", content: [{ type: "output_text", text: "Let me write." }] },
        { type: "function_call", call_id: "call_9", name: "createOrUpdateFiles", arguments: '{"files":[1]}' },
      ],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150, output_tokens_details: { reasoning_tokens: 20 } },
    });
    expect(chat).toEqual({
      id: "resp_1",
      object: "chat.completion",
      created: 123,
      model: "gpt-6.1-terra",
      choices: [
        {
          index: 0,
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: "Let me write.",
            tool_calls: [{ id: "call_9", type: "function", function: { name: "createOrUpdateFiles", arguments: '{"files":[1]}' } }],
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, completion_tokens_details: { reasoning_tokens: 20 } },
    });
  });

  it("reports length when cut off by max_output_tokens, stop otherwise", () => {
    const cut = responsesToChatResponse({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [{ type: "message", content: [{ type: "output_text", text: "partial" }] }],
    });
    expect(cut.choices[0].finish_reason).toBe("length");
    expect(cut.choices[0].message).toEqual({ role: "assistant", content: "partial" });

    const empty = responsesToChatResponse({ output: [] });
    expect(empty.choices[0].finish_reason).toBe("stop");
    expect(empty.choices[0].message.content).toBeNull();
    expect(empty.usage.prompt_tokens).toBe(0);
  });

  it("round-trips: a converted tool call feeds back as a function_call + output pair", () => {
    const chat = responsesToChatResponse({
      output: [{ type: "function_call", call_id: "call_x", name: "readFiles", arguments: '{"files":["a"]}' }],
    });
    const next = chatToResponsesRequest({
      model: "gpt-6.1-sol",
      reasoning_effort: "medium",
      temperature: 1,
      messages: [chat.choices[0].message, { role: "tool", tool_call_id: "call_x", content: "file a" }],
    });
    expect(next.input).toEqual([
      { type: "function_call", call_id: "call_x", name: "readFiles", arguments: '{"files":["a"]}' },
      { type: "function_call_output", call_id: "call_x", output: "file a" },
    ]);
    expect(next.reasoning).toEqual({ effort: "medium" });
    expect(next).not.toHaveProperty("temperature");
  });
});

describe("getReasoningEffort", () => {
  it("uses medium only for advanced web builds", () => {
    expect(getReasoningEffort({ isApp: false, advancedReasoning: true })).toBe("medium");
    expect(getReasoningEffort({ isApp: false, advancedReasoning: false })).toBe("low");
    expect(getReasoningEffort({ isApp: true, advancedReasoning: true })).toBe("low");
  });
});
