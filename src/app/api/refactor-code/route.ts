import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const REFACTOR_SYSTEM_PROMPT = `You are an expert AI code reviewer and refactoring assistant. Your job is to improve, fix, and optimize the provided code snippet while preserving its original functionality.

## Instructions
- You MUST return ONLY the raw refactored code.
- DO NOT wrap the code in markdown blocks (e.g., \`\`\`js or \`\`\`).
- DO NOT add any explanatory text, comments, or greetings before or after the code.
- Ensure the code follows best practices for the given language.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, language } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "No code provided." }, { status: 400 });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: REFACTOR_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Refactor the following ${language || 'code'} snippet:\n\n${code}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2, // Low temperature for more deterministic refactoring
      max_completion_tokens: 16000,
    });

    const refactoredCode = response.choices[0]?.message?.content || "";

    // Clean up any potential markdown code blocks if the model didn't listen
    const cleanCode = refactoredCode
      .replace(/^```[a-z]*\n/gm, '')
      .replace(/```$/gm, '')
      .trim();

    return NextResponse.json({ code: cleanCode });
  } catch (error) {
    console.error("Error in refactor-code:", error);
    return NextResponse.json({ error: "Failed to refactor code." }, { status: 500 });
  }
}
