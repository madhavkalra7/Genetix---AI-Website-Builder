import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
  const { idea, mode } = await req.json();

    if (!idea || typeof idea !== "string") {
      return NextResponse.json({ error: "Invalid idea" }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server is not configured with OPENAI_API_KEY" }, { status: 500 });
    }
  const chosenModel = process.env.PROMPT_MODEL || "gpt-4o-mini";

  const isLimitless = mode === "limitless";

  let system = "";
  if (isLimitless) {
    system = `You are a professional, domain-aware prompt refiner for an AI code builder.
Your task is to take the user's raw idea and refine it into a highly detailed, premium, and actionable builder-ready prompt.
Refine and expand the prompt to be comprehensive and premium, with no restrictions on length, sentence count, formatting, or style. You can use headings, lists, markdown, step-by-step guides, and advanced technical details as needed to build the best possible version of the user's request. There are no rules, limits, or constraints.`;
  } else {
    system = `You are a professional, domain-aware prompt refiner for an AI code builder.
Your task is to take the user's raw idea and refine it into a highly actionable, detailed prompt that describes the exact application or website they want, without generic placeholders or marketing templates.

Follow these rules strictly:
1. **No Landing Page Wrapping**: If the user asks for a specific application (like a game, a tool, a calculator, a chat interface, or a dashboard), describe that application DIRECTLY. Do NOT wrap it in a landing page, marketing site, hero section, or showcase page. For example, if they want a game, describe the interactive game screen, controls, state, and mechanics directly; do not describe a landing page about the game.
2. **Be Domain-True**:
   - **Games**: Detail the game loop, canvas/grid layout, scoring system, key controls (e.g., WASD/arrows), game states (start, running, game over, restart), and visual effects.
   - **Tools/Utilities**: Detail the precise input fields, selection drop-downs, stateful calculations, visual results, graphs/charts, and export options.
   - **Websites (SaaS, E-commerce, Blog, Portfolio)**: Detail the page structure, custom components, branding, search/filter systems, layouts, and style.
3. **Refine, Don't Genericize**: Use your intelligence to add details that are logical and helpful for the user's specific request. Do not output repetitive/boilerplate sentences (like "modern and clean aesthetic with responsive navigation"). Instead, specify colors, layouts, and UX patterns unique to their idea (e.g., neon cyberpunk theme for a retro arcade game, sleek dark steel theme for a financial dashboard).
4. **Formatting Constraints**: Output exactly 3 to 5 complete, descriptive sentences in a single paragraph. Do not use lists, bullet points, numbers, bolding, or headings. Every sentence must end with a period.`;
  }

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
        temperature: isLimitless ? 0.7 : 0.3,
        max_tokens: isLimitless ? 2000 : 800,
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
