import { NextRequest, NextResponse } from "next/server";
import { getSandbox } from "@/inngest/utils";
import { getRequestUserId } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Must be logged in and own the sandbox (sandbox IDs are visible in preview URLs).
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { sandboxId, filePath, content } = await req.json();

    if (!sandboxId || !filePath || content === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (
      typeof sandboxId !== "string" || typeof filePath !== "string" || typeof content !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(sandboxId) || filePath.split(/[\\/]/).includes("..")
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const [ownsWebFragment, ownsAppFragment] = await Promise.all([
      prisma.fragment.findFirst({
        where: { sandboxUrl: { contains: sandboxId }, message: { project: { userId } } },
        select: { id: true },
      }),
      prisma.appFragment.findFirst({
        where: { sandboxUrl: { contains: sandboxId }, appMessage: { appProject: { userId } } },
        select: { id: true },
      }),
    ]);
    if (!ownsWebFragment && !ownsAppFragment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sandbox = await getSandbox(sandboxId);
    await sandbox.files.write(filePath, content);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update sandbox file:", error);
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}
