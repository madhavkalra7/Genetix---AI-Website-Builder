import { NextRequest, NextResponse } from "next/server";
import { getSessionByToken } from '@/lib/auth';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
  const sessionToken = req.cookies.get('session_token')?.value;
  const session = sessionToken ? await getSessionByToken(sessionToken) : null;
  if (session?.user.aiquestUserId) return NextResponse.json({ error: 'Prompt Generator is unavailable in World 6.' }, { status: 403 });
  const { idea, mode } = await req.json();

    if (!idea || typeof idea !== "string") {
      return NextResponse.json({ error: "Invalid idea" }, { status: 400 });
    }
    if (idea.length > 4000) {
      return NextResponse.json({ error: "Idea is too long (max 4000 characters)" }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server is not configured with OPENAI_API_KEY" }, { status: 500 });
    }
  // gpt-6-luna with light reasoning: it has to actually understand the request, not pattern-match it
  const chosenModel = process.env.PROMPT_MODEL || "gpt-6-luna";

  const isLimitless = mode === "limitless";

  const core = `You turn a user's rough request into a precise build prompt for an AI coding agent that writes HTML/CSS/JS (single-page sites, games, tools and mobile web apps).

STEP 1 — UNDERSTAND (do this silently, do not output it):
- What exactly is the user asking for? Classify it: GAME, TOOL/UTILITY (calculator, converter, generator, editor…), APP/DASHBOARD (tracker, manager, chat, planner…), WEBSITE (business, portfolio, product/landing page, blog, event…), or OTHER.
- What concrete details did they give (names, people, places, themes, mechanics, features, style, language, audience)? EVERY one of them must survive into your prompt, unchanged in meaning.
- What would a user who typed this be disappointed NOT to see?

STEP 2 — WRITE THE PROMPT:
- Start with one sentence that states plainly what to build and its type, e.g. "Build a browser fighting game where…", "Build a loan EMI calculator tool that…", "Build a one-page website for…".
- Build THE THING ITSELF. A game is the playable game screen (with start/game-over/restart), NOT a page about the game. A tool opens straight onto the working tool. An app opens on its main working screen. Only a WEBSITE request gets website sections, and only the sections that make sense for that specific business or person.
- NEVER add a hero section, "features" grid, testimonials, pricing, newsletter or footer links unless the request is a website that genuinely needs them.
- Specify the core functionality concretely: for games the mechanics, controls (keyboard AND touch), scoring, win/lose and difficulty; for tools the exact inputs, calculations/logic, outputs and edge cases; for apps the data, actions (add/edit/delete/filter), persistence (localStorage) and screens; for websites the real content for this subject.
- Give it a distinctive visual direction that fits THIS subject (palette, typography mood, layout idea, motion), not generic "modern, clean, responsive".
- Do not invent a different product, do not water down unusual or creative ideas, do not change the genre (a fighting game stays a real-time fighting game, not a quiz or debate), and do not add disclaimers. Keep real names/people/places exactly as written. If the request involves real people in a fictional or playful scenario, describe them as stylised cartoon characters; arcade-style action (punches, kicks, K.O.) is fine, just non-graphic (no blood/gore).
- Write it as instructions to the builder. Output ONLY the prompt — no preamble, no quotes.`;

  const system = isLimitless
    ? `${core}

FORMAT (detailed mode): a thorough spec. Use short markdown headings and bullet lists: Overview, Core functionality, Screens/sections (only those that make sense), Interactions & states, Visual design, Content. Be specific and complete, but every line must be about THIS request — no filler.`
    : `${core}

FORMAT (concise mode): one focused paragraph of 4 to 7 sentences, no lists or headings. Pack in the specifics (type, core functionality, interactions, visual direction).`;

  const user = `User's request:\n${idea}`;

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
        // gpt-6 / reasoning models: use reasoning_effort + max_completion_tokens (temperature unsupported);
        // older chat models (if PROMPT_MODEL is overridden) use temperature.
        ...(/^(gpt-6|gpt-5|o\d)/.test(chosenModel)
          ? { reasoning_effort: "low" }
          : { temperature: isLimitless ? 0.7 : 0.4 }),
        max_completion_tokens: isLimitless ? 4000 : 1500,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Log upstream details server-side only; don't leak them to the client
      console.error("Prompt generator upstream error:", res.status, err?.error?.message || err?.message);
      return NextResponse.json({ error: "Couldn't generate a prompt right now. Please try again." }, { status: 502 });
    }

  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content || "";
  const prompt = (raw || "").trim();

    return NextResponse.json({ prompt });
  } catch (e: any) {
    console.error("Prompt generator error:", e?.message);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
