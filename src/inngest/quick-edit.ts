// ⚡ Quick edit: small, targeted changes (e.g. click-to-edit "make this button bigger")
// in seconds instead of minutes. One focused LLM call returns exact search-and-replace
// patches; no agent loop, no sandbox, no reviewer/browser pipeline.

import { inngest } from "./client";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { createBuild, createBuildTracker, recordBuildUsage } from "@/lib/build-tracker";
import { BUILD_COST, commitBuildReply, isBuildRequestPending } from "@/lib/credits";
import { projectBuildCancelOn, projectBuildConcurrency } from "@/lib/build-queue";
import { validateStaticProject } from "@/lib/static-validator";
import { formatKnowledgeBlock, loadProjectKnowledge } from "@/lib/knowledge";

const QUICK_MODEL = process.env.QUICK_EDIT_MODEL || "gpt-6.1-terra";
const MAX_CONTEXT_CHARS = 150_000;

type Edit = { path: string; find: string; replace: string };
type LlmResult = { summary: string; title: string; edits: Edit[] } | { error: string };

const EDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "title", "edits"],
  properties: {
    summary: { type: "string", description: "1-2 friendly sentences describing what was changed" },
    title: { type: "string", description: "2-4 word title for this version, e.g. 'Bigger New Game Button'" },
    edits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "find", "replace"],
        properties: {
          path: { type: "string", description: "File path exactly as listed" },
          find: { type: "string", description: "Exact existing text copied from the file; must occur exactly once" },
          replace: { type: "string", description: "Replacement text" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are Genetix's fast code editor. You make precise, minimal edits to an existing static web project (HTML/CSS/JS) to fulfil ONE small change request.

Rules:
- Change ONLY what the request needs. Keep everything else byte-for-byte identical.
- Return search-and-replace edits. Each "find" must be copied EXACTLY from the current file (same whitespace/indentation) and must occur exactly once in that file — include a little surrounding context to make it unique. Keep each "find" short (a few lines).
- Prefer the most targeted place: if an element is identified (selector / HTML), change its CSS rule or its markup; add a new specific CSS rule (e.g. using its id) rather than changing shared rules that would affect other elements, unless the request is global.
- Keep the code valid: balanced braces/tags/quotes, no syntax errors, no broken references.
- If the request is impossible without a large rewrite, still do the smallest reasonable version of it.
- Never invent files; only edit files that are listed. To add CSS/JS, append to an existing stylesheet/script via an edit near the end of the file.`;

export function pickContextFiles(files: Record<string, string>): Record<string, string> {
  const text = Object.entries(files).filter(([, c]) => typeof c === "string" && !c.startsWith("data:"));
  const order = (p: string) => (/\.html?$/i.test(p) ? 0 : /\.css$/i.test(p) ? 1 : /\.m?js$/i.test(p) ? 2 : 3);
  text.sort((a, b) => order(a[0]) - order(b[0]));
  const out: Record<string, string> = {};
  let total = 0;
  for (const [p, c] of text) {
    if (total + c.length > MAX_CONTEXT_CHARS && Object.keys(out).length > 0) continue;
    out[p] = c;
    total += c.length;
  }
  return out;
}

export async function callEditor(request: string, files: Record<string, string>, feedback: string | null, buildId: string | null): Promise<LlmResult> {
  const fileBlock = Object.entries(files)
    .map(([p, c]) => `=== FILE: ${p} ===\n${c}`)
    .join("\n\n");
  const input = [
    { role: "developer", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `CHANGE REQUEST:\n${request}\n\nCURRENT PROJECT FILES:\n${fileBlock}` + (feedback ? `\n\nYOUR PREVIOUS ATTEMPT FAILED:\n${feedback}\nReturn corrected edits.` : ""),
    },
  ];
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: QUICK_MODEL,
        reasoning: { effort: "low" },
        store: false,
        max_output_tokens: 8000,
        input,
        text: { format: { type: "json_schema", name: "quick_edits", strict: true, schema: EDIT_SCHEMA } },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return { error: `Model request failed (HTTP ${res.status})` };
    if (buildId && data.usage) {
      await recordBuildUsage(buildId, {
        input: data.usage.input_tokens ?? 0,
        cached: data.usage.input_tokens_details?.cached_tokens ?? 0,
        output: data.usage.output_tokens ?? 0,
        reasoning: data.usage.output_tokens_details?.reasoning_tokens ?? 0,
      });
    }
    const text = (data.output || [])
      .filter((o: { type: string }) => o.type === "message")
      .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content || [])
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text?: string }) => c.text || "")
      .join("");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.edits)) return { error: "Model returned no edits" };
    return { summary: String(parsed.summary || ""), title: String(parsed.title || ""), edits: parsed.edits };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Resolve "index.html" / "/home/user/index.html" variants to the real key. */
function resolveKey(files: Record<string, string>, p: string): string | null {
  const clean = p.replace(/^\.?\/+/, "").replace(/^home\/user\//, "");
  for (const k of [p, clean, `/home/user/${clean}`, `/${clean}`]) if (typeof files[k] === "string") return k;
  return null;
}

export function applyEdits(files: Record<string, string>, edits: Edit[]): { files: Record<string, string>; applied: Edit[]; problems: string[] } {
  const next = { ...files };
  const applied: Edit[] = [];
  const problems: string[] = [];
  edits.forEach((e, i) => {
    const key = resolveKey(next, e.path);
    if (!key) { problems.push(`edit #${i + 1}: file "${e.path}" does not exist`); return; }
    if (!e.find) { problems.push(`edit #${i + 1}: empty "find"`); return; }
    const count = next[key].split(e.find).length - 1;
    if (count !== 1) {
      problems.push(`edit #${i + 1} in ${e.path}: "find" ${count === 0 ? "was not found (copy it exactly)" : `occurs ${count} times (add context)`}`);
      return;
    }
    next[key] = next[key].replace(e.find, () => e.replace);
    applied.push({ ...e, path: key });
  });
  return { files: next, applied, problems };
}

const syntaxIssues = (files: Record<string, string>) =>
  validateStaticProject(files).filter((i) => /syntax error/i.test(i));

export const quickEditFunction = inngest.createFunction(
  {
    id: "quick-edit",
    retries: 1,
    // Same queue as code-agent (identical scope + key): one build per project at a time.
    concurrency: [projectBuildConcurrency()],
    // ⏹ Stop button: cancels this run and the project's queued runs.
    cancelOn: [projectBuildCancelOn()],
    // Nothing is charged unless the edit is saved, so a failure has nothing to refund.
    onFailure: async ({ event, error, step }) => {
      const original = event.data.event as { data: { projectId: string; messageId?: string } };
      const { projectId, messageId } = original.data;
      await step.run("record-failure", async () => {
        const running = await prisma.build.findFirst({ where: { projectId, isApp: false, status: "running" }, orderBy: { startedAt: "desc" }, select: { id: true } });
        const outcome = await commitBuildReply({
          projectId,
          isApp: false,
          messageId,
          buildId: running?.id ?? null,
          creditCost: 0,
          outcome: "failed",
          write: (tx, at) =>
            tx.message.create({
              data: { projectId, content: "Something went wrong while making that edit. No credits were used — please try again.", role: "ASSISTANT", type: "ERROR", createdAt: at, updatedAt: at },
            }),
        });
        if (running && outcome.status !== "cancelled") await createBuildTracker(running.id).finish("failed", { error: error?.message ?? "Quick edit failed" });
      });
    },
  },
  { event: "code-agent/quick-edit" },
  async ({ event, step }) => {
    const projectId: string = event.data.projectId;
    const userRequest: string = String(event.data.value || "");
    const messageId: string | undefined = event.data.messageId;

    // ⏹ Queued runs: skip if the request was answered meanwhile (e.g. the user pressed Stop)
    const stillPending = await step.run("check-request", () => isBuildRequestPending({ projectId, isApp: false, messageId }));
    if (!stillPending) return { ok: false, skipped: true };

    const latest = await step.run("load-latest-version", async () => {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
      const fragment = await prisma.fragment.findFirst({
        where: { message: { projectId } },
        orderBy: { createdAt: "desc" },
        select: { files: true, sandboxUrl: true },
      });
      const knowledge = formatKnowledgeBlock(await loadProjectKnowledge(projectId));
      return { ownerId: project?.userId ?? null, files: (fragment?.files as Record<string, string>) || {}, sandboxUrl: fragment?.sandboxUrl || "", knowledge };
    });

    const buildId = await step.run("create-build", async () => {
      try {
        return await createBuild({ projectId, isApp: false, userId: latest.ownerId, model: QUICK_MODEL, reasoningEffort: "low" });
      } catch {
        return null;
      }
    });
    const tracker = createBuildTracker(buildId);
    // Knowledge (brand/rules) goes with the request so even quick edits follow it
    const request = latest.knowledge ? `${latest.knowledge}

${userRequest}` : userRequest;
    void tracker.event("planning", "Quick edit: reading your project");

    const context = pickContextFiles(latest.files);
    const beforeSyntax = syntaxIssues(latest.files).length;

    // Attempt 1 (+ one corrective retry if edits don't apply or break the code)
    let result = await step.run("quick-edit-1", () => callEditor(request, context, null, buildId));
    let outcome = "error" in result ? null : applyEdits(latest.files, result.edits);
    let feedback: string | null = null;
    if ("error" in result) feedback = result.error;
    else if (outcome && (outcome.problems.length || outcome.applied.length === 0)) feedback = outcome.problems.join("\n") || "No edits were returned.";
    else if (outcome && syntaxIssues(outcome.files).length > beforeSyntax) feedback = `Your edits introduced errors:\n${syntaxIssues(outcome.files).join("\n")}`;

    if (feedback) {
      void tracker.event("fixing", "Retrying the edit");
      result = await step.run("quick-edit-2", () => callEditor(request, context, feedback, buildId));
      outcome = "error" in result ? null : applyEdits(latest.files, result.edits);
      if (outcome && syntaxIssues(outcome.files).length > beforeSyntax) outcome = null; // never save broken code
    }

    const ok = !!outcome && !("error" in result) && outcome.applied.length > 0;
    if (ok) {
      for (const e of outcome!.applied) void tracker.event("editing", e.path, { file: e.path, code: e.replace });
    }
    void tracker.event("saving", ok ? "Saving the new version" : "Nothing could be applied");

    // 💾 Save + charge in one transaction; a stopped build is neither saved nor charged.
    const saved = await step.run("save-result", async () => {
      const r = ok ? (result as { summary: string; title: string }) : null;
      const title = r ? (r.title || "Quick edit").replace(/["'`<>]/g, "").slice(0, 60) || "Quick edit" : "";
      return commitBuildReply({
        projectId,
        isApp: false,
        messageId,
        buildId,
        ownerId: event.data.userId ?? latest.ownerId,
        creditCost: event.data.creditCost ?? BUILD_COST.web,
        outcome: ok ? "succeeded" : "failed",
        write: async (tx, at) => {
          if (!r) {
            await tx.message.create({
              data: {
                projectId,
                role: "ASSISTANT",
                type: "ERROR",
                createdAt: at,
                updatedAt: at,
                content: "I couldn't apply that change precisely, so nothing was modified. No credits were used — try describing it a bit differently, or send it as a normal chat message for a full rebuild.",
              },
            });
            return;
          }
          await tx.message.create({
            data: {
              projectId,
              role: "ASSISTANT",
              type: "RESULT",
              createdAt: at,
              updatedAt: at,
              content: r.summary || "Done — I made that change.",
              fragments: {
                create: { title, sandboxUrl: latest.sandboxUrl, files: outcome!.files as Prisma.InputJsonValue },
              },
            },
          });
          await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
        },
      });
    });
    if (saved.status === "cancelled") return { ok: false, cancelled: true };

    await tracker.event(ok ? "done" : "failed", ok ? "Edit applied" : "Edit could not be applied");
    await tracker.finish(ok ? "succeeded" : "failed", { error: ok ? null : "Quick edit could not be applied" });
    return { ok };
  }
);
