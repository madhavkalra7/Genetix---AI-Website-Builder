// Chat Completions -> Responses API bridge.
// @inngest/agent-kit only speaks Chat Completions, but gpt-6 models only allow
// reasoning + function tools on /v1/responses. The code agent (Advanced Reasoning mode)
// points its baseUrl here; we translate the request, call OpenAI, and translate back.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { chatToResponsesRequest, responsesToChatResponse } from "@/lib/responses-bridge";

export const runtime = "nodejs";
export const maxDuration = 300; // reasoning turns can be slow

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.OPENAI_API_KEY;
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const responsesBody = chatToResponsesRequest(body);

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
    console.error("❌ Responses bridge upstream error:", upstream.status, JSON.stringify(data?.error ?? data).slice(0, 500));
    return NextResponse.json(
      { error: data?.error ?? { message: `OpenAI Responses API failed (HTTP ${upstream.status})` } },
      { status: upstream.ok ? 502 : upstream.status }
    );
  }

  const chat = responsesToChatResponse(data);
  console.log(
    `🧠 Responses bridge: ${data.model} effort=${responsesBody.reasoning?.effort ?? "none"} ` +
      `in=${chat.usage.prompt_tokens} out=${chat.usage.completion_tokens} ` +
      `reasoning=${chat.usage.completion_tokens_details.reasoning_tokens}`
  );
  return NextResponse.json(chat);
}
