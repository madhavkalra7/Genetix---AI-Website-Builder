// Build queue helpers (pure, client-safe).
//
// A project builds one request at a time (Inngest concurrency, see src/inngest/functions.ts).
// Every build request is a USER message; every finished/failed/stopped build writes exactly one
// ASSISTANT reply (a RESULT with a fragment, or an ERROR). The pipeline places that reply
// directly after the USER message it answers (see placeBuildReply in src/lib/credits.ts), so
// "pending" requests are simply the USER messages after the last build reply.
//
// Plan-mode chat (ASSISTANT RESULT without a fragment) is not a build: a USER message that is
// answered by a plan reply is ignored, and plan replies don't end the queue.

/** Event that stops the running build and every queued build of a project. */
export const BUILD_CANCEL_EVENT = "code-agent/cancel";

/**
 * Inngest concurrency shared by code-agent AND quick-edit (scope "env" + the same key = one
 * queue across both functions): one build per project at a time, later ones wait in order.
 * Key is a CEL expression evaluated on the triggering event.
 */
export const projectBuildConcurrency = () => ({
  scope: "env" as const,
  key: '"project-" + event.data.projectId',
  limit: 1,
});

/** Cancel this project's running and queued runs when BUILD_CANCEL_EVENT arrives. */
export const projectBuildCancelOn = () => ({
  event: BUILD_CANCEL_EVENT,
  match: "data.projectId",
});

export interface QueueMessageLike {
  role: string;
  type: string;
  /** Fragment relation (web: `fragments`, app: `fragments`); any non-null value = has a version */
  fragments?: unknown;
}

/** ASSISTANT message that answers a build request (new version, or an error/stop notice). */
export function isBuildReply(m: QueueMessageLike): boolean {
  return m.role === "ASSISTANT" && (m.type === "ERROR" || m.fragments != null);
}

/** ASSISTANT plan-mode reply: chat only, never a build. */
export function isPlanReply(m: QueueMessageLike): boolean {
  return m.role === "ASSISTANT" && m.type === "RESULT" && m.fragments == null;
}

/**
 * USER messages still waiting for a build, oldest first (messages must be in chronological
 * order). The first one is building; the rest are queued behind it.
 */
export function getPendingBuildMessages<T extends QueueMessageLike>(messages: readonly T[]): T[] {
  let pending: T[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "USER") {
      const next = messages[i + 1];
      if (next && isPlanReply(next)) continue; // a plan-mode exchange, not a build request
      pending.push(m);
    } else if (isBuildReply(m)) {
      pending = [];
    }
  }
  return pending;
}

/**
 * Where a build reply goes in the chat: right after the USER message it answers, i.e. just
 * before whatever was sent after it (queued requests, plan chat), or "now" if nothing was.
 * `messages` must be chronological and contain `request`.
 */
export function replyTimestamp<T extends { id: string; createdAt: Date | string }>(
  messages: readonly T[],
  requestId: string,
  now: Date = new Date(),
): Date {
  const index = messages.findIndex((m) => m.id === requestId);
  if (index === -1) return now;
  const next = messages[index + 1];
  if (!next) return now;
  const requestMs = new Date(messages[index].createdAt).getTime();
  const nextMs = new Date(next.createdAt).getTime();
  return new Date(Math.min(now.getTime(), Math.max(requestMs, nextMs - 1)));
}

/** Text of the single notice written when the user stops a build (and its queue). */
export function stoppedMessageText(cancelledRequests: number): string {
  if (cancelledRequests <= 1) return "Stopped. No credits were used.";
  const queued = cancelledRequests - 1;
  return `Stopped. The current build and ${queued} queued request${queued === 1 ? "" : "s"} were cancelled. No credits were used.`;
}
