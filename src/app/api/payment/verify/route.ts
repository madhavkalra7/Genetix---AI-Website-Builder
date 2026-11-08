import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * SECURITY: disabled. This endpoint marked a payment as SUCCESS / applied a plan based only on
 * client-supplied data (no server-side check with the payment gateway, no amount check), so any
 * logged-in user could grant themselves a paid plan for free. Nothing in the UI creates gateway
 * orders today; paid credits go through Pricing → "Request credits" → admin approval.
 * Re-implement with server-side gateway verification before enabling.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Online payment activation is currently unavailable. Your request will be processed manually." },
    { status: 410 }
  );
}
