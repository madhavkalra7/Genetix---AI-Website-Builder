import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CODE_EXPLAINER_SYSTEM_PROMPT = `You are "CodeGuru" - a friendly and expert code explainer. Your job is to explain code in a clear, structured, and visually appealing way.

## Your Explanation Style:
- Be concise but thorough
- Use simple language that beginners can understand
- Highlight important parts of the code
- Use emojis sparingly to make it engaging 🎯

## Output Format for Each File:

### 📁 [filename]

**🎯 Purpose:** [One line about what this file does]

**📝 Key Code Snippet:**
\`\`\`[language]
[Show only the most important 5-15 lines of code]
\`\`\`

**💡 Explanation:**
- Point 1: [Explain what this part does]
- Point 2: [Explain another important part]
- Point 3: [Any important detail]

---

## At the End - Project Summary:

### 🚀 Project Overview
[2-3 sentences about what the entire project does]

### 🔧 Tech Stack Used
- [List technologies/frameworks detected]

### 📊 Project Structure
[Brief description of how files work together]

IMPORTANT: Keep explanations SHORT and FOCUSED. Don't show entire code files - only show the most important snippets (5-15 lines max per file).`;

async function generateWithGPT(prompt: string, systemPrompt?: string): Promise<string | null> {
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }
    
    messages.push({
      role: "user",
      content: prompt,
    });

    const response = await openai.chat.completions.create({
      model: "o4-mini",
      messages,
      max_completion_tokens: 16000,
    });
    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // If filesOnly is true, return files for the projectId
    if (body.filesOnly && body.projectId) {
      // Fetch latest Fragment for projectId by joining through Message
      const { prisma } = await import("@/lib/db");
      const fragment = await prisma.fragment.findFirst({
        where: {
          message: {
            projectId: body.projectId
          }
        },
        orderBy: { createdAt: "desc" },
        include: { message: true }
      });
      if (!fragment || !fragment.files) {
        return NextResponse.json({ error: "No files found for this project." }, { status: 404 });
      }
      return NextResponse.json({ files: fragment.files });
    }
    // If only query is sent, treat as GPT chatbot
    if (body.query && !body.files) {
      const prompt = body.query;

      // Input validation: check query length
      if (typeof prompt !== "string" || prompt.length < 3 || prompt.length > 1000) {
        return NextResponse.json({ error: "Query must be between 3 and 1000 characters." }, { status: 400 });
      }

      // Basic content filtering (example: block certain words)
      const forbiddenWords = ["hack", "attack", "malware"];
      if (forbiddenWords.some(word => prompt.toLowerCase().includes(word))) {
        return NextResponse.json({ error: "Query contains forbidden content." }, { status: 400 });
      }
      
      const explanation = await generateWithGPT(prompt);
      if (!explanation) {
        return NextResponse.json({ error: "No explanation generated." }, { status: 500 });
      }
      return NextResponse.json({ explanation });
    }

    // Code explanation with better structure
    const { files } = body;
    if (!files || typeof files !== "object") {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }
    
    const fileSummaries = Object.entries(files)
      .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
      .join("\n\n");
    
    const prompt = `Please analyze and explain this project. Remember to show only KEY CODE SNIPPETS (5-15 lines max per file), not the entire code.\n\nProject Files:\n\n${fileSummaries}`;

    const explanation = await generateWithGPT(prompt, CODE_EXPLAINER_SYSTEM_PROMPT);
    if (!explanation) {
      return NextResponse.json({ error: "No explanation generated." }, { status: 500 });
    }
    return NextResponse.json({ explanation });
  } catch (e) {
    console.error("Error in explain-project:", e);
    return NextResponse.json({ error: "Failed to generate explanation." }, { status: 500 });
  }
}
