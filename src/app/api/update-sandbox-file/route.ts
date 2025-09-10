import { NextRequest, NextResponse } from "next/server";
import { getSandbox } from "@/inngest/utils";

export async function POST(req: NextRequest) {
  try {
    const { sandboxId, filePath, content } = await req.json();

    console.log("Received request to update sandbox file:", { sandboxId, filePath, contentLength: content?.length });

    if (!sandboxId || !filePath || content === undefined) {
      console.error("Missing required fields:", { sandboxId: !!sandboxId, filePath: !!filePath, content: content !== undefined });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get sandbox instance and update file
    console.log("Connecting to sandbox:", sandboxId);
    const sandbox = await getSandbox(sandboxId);
    
    console.log("Writing file:", filePath);
    await sandbox.files.write(filePath, content);
    
    console.log("File updated successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update sandbox file:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update file: " + message }, { status: 500 });
  }
}
