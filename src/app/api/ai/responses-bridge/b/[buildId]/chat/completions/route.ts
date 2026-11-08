// Per-build bridge URL: same as /api/ai/responses-bridge but records token usage on the
// Build row and enforces the per-build token budget.

import { NextRequest } from "next/server";
import { handleBridgeRequest } from "@/lib/responses-bridge-handler";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ buildId: string }> }) {
  const { buildId } = await params;
  return handleBridgeRequest(req, /^[a-z0-9]{10,40}$/i.test(buildId) ? buildId : undefined);
}
