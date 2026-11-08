// Chat Completions -> Responses API bridge (no build tracking).
// @inngest/agent-kit only speaks Chat Completions, but gpt-6 models only allow
// reasoning + function tools on /v1/responses. See src/lib/responses-bridge-handler.ts.

import { NextRequest } from "next/server";
import { handleBridgeRequest } from "@/lib/responses-bridge-handler";

export const runtime = "nodejs";
export const maxDuration = 300; // reasoning turns can be slow

export async function POST(req: NextRequest) {
  return handleBridgeRequest(req);
}
