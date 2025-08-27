import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
  const { idea } = await req.json();

    if (!idea || typeof idea !== "string") {
      return NextResponse.json({ error: "Invalid idea" }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server is not configured with OPENAI_API_KEY" }, { status: 500 });
    }
  const chosenModel = process.env.PROMPT_MODEL || "gpt-4o-mini";

  const system = `You are a helpful assistant that writes concise website-building prompts for an AI website builder.
Return 3-5 complete sentences (no lists, no numbering, no headings). Be specific: pages/sections, style, key components, data needs, and constraints. End sentences with a period.`;
    const user = `Website idea: ${idea}`;

    // Call OpenAI Chat Completions for stability
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err?.error?.message || err?.message || `Model error (${res.status})`;
      return NextResponse.json({ error: message }, { status: 400 });
    }

  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content || "";
  const prompt = (raw || "").trim();

    return NextResponse.json({ prompt });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
