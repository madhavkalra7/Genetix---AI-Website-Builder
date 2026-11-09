import { describe, expect, it, vi } from "vitest";
import { aiProblemUserMessage, classifyErrorText, classifyOpenAIError, logOpenAIError, userMessageForFailure } from "@/lib/openai-errors";

// The exact error OpenAI returned when the org spend limit was hit
const SPEND_LIMIT = {
  error: {
    message: "Your organization has reached its configured enforced spend limit. Update your limit at https://platform.openai.com/settings/organization/limits.",
    type: "insufficient_quota",
    param: null,
    code: "organization_spend_limit_exceeded",
  },
};

describe("openai-errors", () => {
  it("classifies the spend-limit 429 as quota (not a retryable rate limit)", () => {
    expect(classifyOpenAIError(429, SPEND_LIMIT)).toBe("quota");
    expect(classifyOpenAIError(429, { error: { message: "You exceeded your current quota", type: "insufficient_quota" } })).toBe("quota");
  });

  it("classifies other common failures", () => {
    expect(classifyOpenAIError(401, { error: { message: "Incorrect API key provided", code: "invalid_api_key" } })).toBe("auth");
    expect(classifyOpenAIError(404, { error: { message: "The model `x` does not exist or you do not have access to it.", code: "model_not_found" } })).toBe("model");
    expect(classifyOpenAIError(429, { error: { message: "Rate limit reached for requests", code: "rate_limit_exceeded" } })).toBe("rate");
    expect(classifyOpenAIError(500, null)).toBe("server");
    expect(classifyOpenAIError(400, { error: { message: "Invalid value for 'input'" } })).toBe("other");
    expect(classifyOpenAIError(429, { error: { message: "Genetix has reached today's AI limit.", code: "daily_token_limit" } })).toBe("daily");
  });

  it("logs one line with the reason and the fix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logOpenAIError("prompt-generator", 429, SPEND_LIMIT);
    const line = String(spy.mock.calls[0][0]);
    expect(line).toContain("[openai:quota] prompt-generator: HTTP 429 insufficient_quota/organization_spend_limit_exceeded");
    expect(line).toContain("settings/organization/limits");
    spy.mockRestore();
  });

  it("gives users a clear message for provider problems and keeps generic ones generic", () => {
    expect(aiProblemUserMessage("quota")).toMatch(/temporarily unavailable/);
    expect(classifyErrorText("Model request failed (HTTP 429, quota): organization_spend_limit_exceeded")).toBe("quota");
    expect(userMessageForFailure("Error: 429 Your organization has reached its configured enforced spend limit", "fallback")).toMatch(
      /temporarily unavailable.*No credits were used/
    );
    expect(userMessageForFailure("TypeError: cannot read x of undefined", "fallback")).toBe("fallback");
    expect(userMessageForFailure(undefined, "fallback")).toBe("fallback");
  });
});
