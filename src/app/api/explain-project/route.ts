import { NextRequest, NextResponse } from "next/server";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    // If only query is sent, treat as Gemini chatbot
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );
      const data = await response.json();
      let explanation = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!explanation) {
        console.error("Gemini response:", JSON.stringify(data, null, 2));
        return NextResponse.json({ error: "No explanation generated.", fullResponse: data });
      }
      return NextResponse.json({ explanation });
    }

    // ...existing code for code explanation...
    const { files } = body;
    if (!files || typeof files !== "object") {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }
    const fileSummaries = Object.entries(files)
      .map(([path, content]) => `File: ${path}\n${content}`)
      .join("\n\n");
    const prompt = `You are an expert software engineer. For each file in the following project, do the following:\n\n1. Show the file name as a heading.\n2. Show the code in a proper rounded boundary code block.\n3. Write a clear, simple explanation of what the code does.\n\nAfter all files, provide a short overall project summary again in box.\n\nProject files:\n\n${fileSummaries}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );
    const data = await response.json();
    let explanation = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!explanation) {
      console.error("Gemini response:", JSON.stringify(data, null, 2));
      return NextResponse.json({ error: "No explanation generated.", fullResponse: data });
    }
    return NextResponse.json({ explanation });
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate explanation." }, { status: 500 });
  }
}
