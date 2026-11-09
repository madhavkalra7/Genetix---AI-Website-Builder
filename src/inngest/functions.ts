import { inngest } from "./client";
import { createAgent, createTool, createNetwork, type Tool, openai, type Message, type AgentResult, createState } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { z } from "zod";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { FRAGMENT_TITLE_PROMPT, getTechSpecificPrompt, RESPONSE_PROMPT, MOBILE_APP_PROMPT, CODE_REVIEWER_PROMPT, EDIT_TOOL_RULES, supabaseBackendRules } from "@/prompt";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "./types";
import { extractKeywords, fetchRelevantImages } from "@/lib/image-fetcher";
import { getTemplateById } from "@/lib/templates";
import { searchWeb, isWebSearchEnabled, MAX_WEB_SEARCHES_PER_RUN, WEB_SEARCH_INSTRUCTIONS } from "@/lib/web-search";
import { getReasoningEffort, getResponsesBridgeBaseUrl } from "@/lib/responses-bridge";
import { validateStaticProject, formatValidationFeedback } from "@/lib/static-validator";
import { refundCredit, getProjectOwnerId } from "@/lib/credit-refund";
import { createBuild, createBuildTracker } from "@/lib/build-tracker";
import { formatKnowledgeBlock } from "@/lib/knowledge";
import { runBrowserQa, formatBrowserFindings, type BrowserQaResult } from "@/lib/browser-qa";
import fs from "fs";
import path from "path";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
  {
    id: "code-agent",
    // Runs after the function has failed permanently (all retries exhausted).
    // Without this the UI waits forever (no ASSISTANT message) and the credit is lost.
    onFailure: async ({ event, error, step }) => {
      const original = event.data.event as { data: { projectId: string; isApp?: boolean; creditCost?: number } };
      const { projectId } = original.data;
      const isApp = original.data.isApp === true;
      const creditCost = original.data.creditCost ?? (isApp ? 5 : 1);
      console.error("❌ code-agent failed permanently:", error?.message);

      await step.run("record-failure-and-refund", async () => {
        // Skip if a result/error was already saved for the latest request (avoids double refunds)
        const last = isApp
          ? await prisma.appMessage.findFirst({ where: { appProjectId: projectId }, orderBy: { createdAt: "desc" }, select: { role: true } })
          : await prisma.message.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { role: true } });
        if (!last || last.role === "ASSISTANT") return;

        const content = "Something went wrong while building this. Your credit has been refunded — please try again.";
        if (isApp) {
          await prisma.appMessage.create({ data: { appProjectId: projectId, content, role: "ASSISTANT", type: "ERROR" } });
        } else {
          await prisma.message.create({ data: { projectId, content, role: "ASSISTANT", type: "ERROR" } });
        }
        const ownerId = await getProjectOwnerId(projectId, isApp);
        if (ownerId) await refundCredit(ownerId, creditCost);
      });

      await step.run("mark-build-failed", async () => {
        const running = await prisma.build.findFirst({
          where: { projectId, isApp, status: "running" },
          orderBy: { startedAt: "desc" },
          select: { id: true },
        });
        if (running) {
          await createBuildTracker(running.id).finish("failed", { error: error?.message ?? "Build failed" });
        }
      });
    },
  },
  { event: "code-agent/run" },
  async ({ event, step }) => {

    // Verify API keys are available
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY is not set!");
      throw new Error("OpenAI API key is missing");
    }
    if (!process.env.E2B_API_KEY) {
      console.error("❌ E2B_API_KEY is not set!");
      throw new Error("E2B API key is missing");
    }
    console.log("✅ API keys verified");

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID || "htrjn0k08ekwyjfwkcpo");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });

    const { previousMessages, projectTechStack, previousFiles, useAdvancedReasoning, ownerId, supabase, knowledge } = await step.run("get-project-data", async () => {
      const formattedMessages:Message[]=[];
      const isApp = event.data.isApp === true;

      if (isApp) {
        // AppProject logic
        const project = await prisma.appProject.findUnique({
          where: { id: event.data.projectId },
          select: { name: true, userId: true, user: { select: { knowledge: true } } }
        });

        const messages = await prisma.appMessage.findMany({
          where: { appProjectId: event.data.projectId },
          include: { fragments: true },
          orderBy: { createdAt: "asc" }
        });

        const latestFragment = await prisma.appFragment.findFirst({
          where: { appMessage: { appProjectId: event.data.projectId } },
          orderBy: { createdAt: "desc" },
          select: { files: true }
        });

        for (const message of messages) {
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          } as any);
        }

        return {
          previousMessages: formattedMessages,
          projectTechStack: "html-css-js", // Always static html-css-js for mobile previews
          previousFiles: (latestFragment?.files as { [path: string]: string }) || {},
          useAdvancedReasoning: false,
          ownerId: project?.userId ?? null,
          supabase: null as { url: string; anonKey: string } | null,
          knowledge: { project: null as string | null, workspace: project?.user?.knowledge ?? null },
        };
      } else {
        // Standard Project logic
        const project = await prisma.project.findUnique({
          where: { id: event.data.projectId },
          select: { techStack: true, advancedReasoning: true, userId: true, supabaseUrl: true, supabaseAnonKey: true, knowledge: true, user: { select: { knowledge: true } } }
        });

        const messages = await prisma.message.findMany({
          where: { projectId: event.data.projectId },
          include: { fragments: true },
          orderBy: { createdAt: "asc" }
        });
        
        const latestFragment = await prisma.fragment.findFirst({
          where: { message: { projectId: event.data.projectId } },
          orderBy: { createdAt: "desc" },
          select: { files: true }
        });

        for (const message of messages) {
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          });
        }
        
        return {
          previousMessages: formattedMessages,
          projectTechStack: project?.techStack || "react-nextjs",
          previousFiles: (latestFragment?.files as { [path: string]: string }) || {},
          useAdvancedReasoning: project?.advancedReasoning || false,
          ownerId: project?.userId ?? null,
          supabase: project?.supabaseUrl && project?.supabaseAnonKey
            ? { url: project.supabaseUrl, anonKey: project.supabaseAnonKey }
            : null,
          knowledge: { project: project?.knowledge ?? null, workspace: project?.user?.knowledge ?? null },
        };
      }
    });

    // 📊 One Build row per run: live progress for the UI, token usage/cost, admin logs
    const buildId = await step.run("create-build", async () => {
      try {
        const isAppRun = event.data.isApp === true;
        return await createBuild({
          projectId: event.data.projectId,
          isApp: isAppRun,
          userId: ownerId,
          model: useAdvancedReasoning ? "gpt-6.1-sol" : "gpt-6.1-terra",
          reasoningEffort: getReasoningEffort({ isApp: isAppRun, advancedReasoning: useAdvancedReasoning }),
        });
      } catch (e) {
        console.warn("⚠️ Could not create Build row:", e);
        return null;
      }
    });
    const tracker = createBuildTracker(buildId);

    const state=createState<AgentState>(
      {
      summary:"",
      files: previousFiles, // Initialize with previous files so agent can see existing code
      },
      {
        messages:previousMessages,
      },
  );

    const terminalSchema = z.object({
      command: z.string(),
    });

    const createOrUpdateFilesSchema = z.object({
      files: z.array(
        z.object({
          path: z.string(),
          content: z.string(),
        })
      ),
    });

    const readFilesSchema = z.object({
      files: z.array(z.string()),
    });

    const terminalTool = createTool({
      name: "terminal",
      description: "Use the terminal to run commands",
      parameters: terminalSchema,
      handler: async ({ command }, { step }) => {
        return await step?.run("terminal", async () => {
          const buffers = { stdout: "", stderr: "" };
          try {
            const sandbox = await getSandbox(sandboxId);
            const result = await sandbox.commands.run(command, {
              onStdout: (data: string) => { buffers.stdout += data; },
              onStderr: (data: string) => { buffers.stderr += data; },
            });
            return result.stdout;
          } catch (e) {
            return `Command failed: ${e} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`;
          }
        });
      },
    });

    // Find the state key for a path ("index.html" vs "/home/user/index.html")
    const resolveFileKey = (files: { [path: string]: string }, p: string): string | null => {
      const clean = p.replace(/^\.?\/+/, "").replace(/^home\/user\//, "");
      for (const key of [p, clean, `/home/user/${clean}`, `/${clean}`]) {
        if (typeof files[key] === "string") return key;
      }
      return null;
    };

    const createOrUpdateFilesTool = createTool({
      name: "createOrUpdateFiles",
      description: "Create new files or completely rewrite files (full contents). For small changes to an existing file prefer editFile.",
      parameters: createOrUpdateFilesSchema,
      handler: async ({ files }, { step, network }) => {
        const paths = files.map((f) => f.path).join(", ");
        // One event per file, carrying the code (powers the live code-writing animation)
        for (const f of files) {
          void tracker.event(network.state.data.summary ? "fixing" : "writing", f.path, { file: f.path, code: f.content });
        }
        const newFiles = await step?.run("createOrUpdateFiles", async () => {
          try {
            const updatedFiles = network.state.data.files || {};
            const sandbox = await getSandbox(sandboxId);
            for (const file of files) {
              await sandbox.files.write(file.path, file.content);
              updatedFiles[file.path] = file.content;
            }
            return updatedFiles;
          } catch (e) {
            return "Error: " + e;
          }
        });
        if (typeof newFiles === "object") {
          network.state.data.files = newFiles;
          return `Wrote ${files.length} file(s): ${paths}`;
        }
        return `Failed to write files: ${newFiles}`;
      },
    });

    // ✂️ Targeted search-and-replace edits (faster, cheaper and safer than rewriting whole files)
    const editFileTool = createTool({
      name: "editFile",
      description:
        "Edit an EXISTING file with exact search-and-replace. Each `find` must be copied exactly from the current file (readFiles first) and match exactly once — include a few surrounding lines to make it unique. All edits are applied together or none are. Use this for changes to existing files instead of rewriting them.",
      parameters: z.object({
        path: z.string().describe("File path, e.g. index.html"),
        edits: z.array(z.object({
          find: z.string().describe("Exact existing text to replace (must occur exactly once)"),
          replace: z.string().describe("Replacement text"),
        })).min(1),
      }),
      handler: async ({ path: filePath, edits }, { step, network }) => {
        void tracker.event(network.state.data.summary ? "fixing" : "editing", filePath, {
          file: filePath,
          code: edits.map((e) => e.replace).join("\n\n/* … */\n\n"),
        });
        const outcome = await step?.run("editFile", async () => {
          try {
            const files = network.state.data.files || {};
            const key = resolveFileKey(files, filePath);
            const sandbox = await getSandbox(sandboxId);
            let content = key ? files[key] : await sandbox.files.read(filePath).catch(() => null);
            if (typeof content !== "string") {
              return { ok: false as const, message: `File not found: ${filePath}. Use createOrUpdateFiles to create it.` };
            }
            const problems: string[] = [];
            edits.forEach((e, i) => {
              if (!e.find) { problems.push(`edit #${i + 1}: empty find`); return; }
              const count = content!.split(e.find).length - 1;
              if (count === 0) problems.push(`edit #${i + 1}: text not found (copy it exactly from the current file)`);
              else if (count > 1) problems.push(`edit #${i + 1}: text occurs ${count} times (add surrounding lines to make it unique)`);
              else content = content!.replace(e.find, () => e.replace);
            });
            if (problems.length) {
              return { ok: false as const, message: `No changes applied to ${filePath}:\n- ${problems.join("\n- ")}` };
            }
            await sandbox.files.write(key ?? filePath, content);
            return { ok: true as const, key: key ?? filePath, content };
          } catch (e) {
            return { ok: false as const, message: "Error: " + e };
          }
        });
        if (!outcome) return "Edit failed";
        if (!outcome.ok) return outcome.message;
        network.state.data.files = { ...(network.state.data.files || {}), [outcome.key]: outcome.content };
        return `Applied ${edits.length} edit(s) to ${filePath}`;
      },
    });

    const readFilesTool = createTool({
      name: "readFiles",
      description: "Read files from the sandbox",
      parameters: readFilesSchema,
      handler: async ({ files }, { step }) => {
        return await step?.run("readFiles", async () => {
          try {
            const sandbox = await getSandbox(sandboxId);
            const contents = [];
            for (const file of files) {
              const content = await sandbox.files.read(file);
              contents.push({ path: file, content });
            }
            return JSON.stringify(contents);
          } catch (e) {
            return "Error: " + e;
          }
        });
      },
    });

    // 🔎 Live web search via You.com (enabled only when YOU_API_KEY is set)
    const webSearchEnabled = isWebSearchEnabled();
    let webSearchCount = 0;

    const webSearchTool = createTool({
      name: "webSearch",
      description:
        "Search the live web (You.com) for real-world facts, current library/framework docs, real business details, and up-to-date content. Returns titles, URLs and snippets.",
      parameters: z.object({
        // NOTE: OpenAI strict tool schemas require every property to be required — don't add optional fields.
        query: z.string().describe("A focused search query"),
      }),
      handler: async ({ query }, { step }) => {
        webSearchCount += 1;
        if (webSearchCount > MAX_WEB_SEARCHES_PER_RUN) {
          return `Web search limit (${MAX_WEB_SEARCHES_PER_RUN}) reached for this task. Proceed with the information you already have.`;
        }
        void tracker.event("searching", query);
        return await step?.run("webSearch", async () => {
          console.log(`🔎 Web search #${webSearchCount}: ${query}`);
          return await searchWeb(query, 5);
        });
      },
    });

    // Bootstrap essential UI files so the agent doesn't fail on missing components
    await step.run("bootstrap-ui", async () => {
      try {
        const sandbox = await getSandbox(sandboxId);
        const ensure = async (path: string, content: string) => {
          try {
            await sandbox.files.read(path);
          } catch {
            await sandbox.files.write(path, content);
          }
        };

        await ensure("lib/utils.ts", `export function cn(...inputs: Array<string | undefined | null | false>) {\n  return inputs.filter(Boolean).join(" ");\n}\n`);

        await ensure("components/ui/button.tsx", `import * as React from "react";\nimport { cn } from "@/lib/utils";\nexport interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {\n  asChild?: boolean;\n}\nexport const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(\n  ({ className, ...props }, ref) => {\n    return (\n      <button ref={ref} className={cn("inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none border border-white/20 bg-white/10 hover:bg-white/20", className)} {...props} />\n    );\n  }\n);\nButton.displayName = "Button";\n`);

        await ensure("components/ui/input.tsx", `import * as React from "react";\nimport { cn } from "@/lib/utils";\nexport interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}\nexport const Input = React.forwardRef<HTMLInputElement, InputProps>(\n  ({ className, ...props }, ref) => {\n    return <input ref={ref} className={cn("flex h-10 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30", className)} {...props} />;\n  }\n);\nInput.displayName = "Input";\n`);

        await ensure("components/ui/avatar.tsx", `import * as React from "react";\nimport { cn } from "@/lib/utils";\nexport const Avatar = ({ className, children }: { className?: string; children?: React.ReactNode }) => (\n  <div className={cn("inline-flex h-9 w-9 overflow-hidden rounded-full bg-white/10", className)}>{children}</div>\n);\nexport const AvatarImage = ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (\n  // eslint-disable-next-line @next/next/no-img-element\n  <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />\n);\nexport const AvatarFallback = ({ children, className }: { children?: React.ReactNode; className?: string }) => (\n  <div className={cn("flex h-full w-full items-center justify-center text-xs", className)}>{children}</div>\n);\n`);

        await ensure("components/ui/dialog.tsx", `import * as React from "react";\nexport const Dialog = ({ children }: { children?: React.ReactNode }) => <>{children}</>;\nexport const DialogTrigger = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (\n  <span onClick={onClick} role="button">{children}</span>\n);\nexport const DialogContent = ({ children }: { children?: React.ReactNode }) => (\n  <div>{children}</div>\n);\n`);

        await ensure("components/ui/card.tsx", `import * as React from "react";\nimport { cn } from "@/lib/utils";\nexport const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (\n  <div className={cn("rounded-xl border border-white/15 bg-white/5", className)} {...props} />\n);\nexport const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (\n  <div className={cn("p-4 border-b border-white/10", className)} {...props} />\n);\nexport const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (\n  <h3 className={cn("text-lg font-semibold", className)} {...props} />\n);\nexport const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (\n  <p className={cn("text-sm text-white/70", className)} {...props} />\n);\nexport const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (\n  <div className={cn("p-4", className)} {...props} />\n);\n`);

        await ensure("components/ui/scroll-area.tsx", `import * as React from "react";\nimport { cn } from "@/lib/utils";\nexport const ScrollArea = ({ className, children }: { className?: string; children?: React.ReactNode }) => (\n  <div className={cn("relative overflow-auto", className)}>{children}</div>\n);\nexport const ScrollBar = () => null;\n`);

        await ensure("components/ui/label.tsx", `import * as React from "react";\nimport { cn } from "@/lib/utils";\nexport interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}\nexport const Label = React.forwardRef<HTMLLabelElement, LabelProps>(\n  ({ className, ...props }, ref) => {\n    return <label ref={ref} className={cn("text-sm font-medium", className)} {...props} />;\n  }\n);\nLabel.displayName = "Label";\n`);
      } catch {
        // best-effort bootstrap
      }
    });

    // Ensure common icon packages are available to avoid module-not-found
    await step.run("bootstrap-deps", async () => {
      try {
        const sandbox = await getSandbox(sandboxId);
        await sandbox.commands.run("npm install @radix-ui/react-icons lucide-react --yes");
      } catch {
        // best-effort install
      }
    });

    // ✅ CRITICAL: Pre-load existing files into sandbox
    await step.run("preload-existing-files", async () => {
      if (previousFiles && Object.keys(previousFiles).length > 0) {
        try {
          const sandbox = await getSandbox(sandboxId);
          console.log(`📦 Pre-loading ${Object.keys(previousFiles).length} existing files into sandbox...`);
          
          for (const [filePath, content] of Object.entries(previousFiles)) {
            // For all blob-based projects (HTML/Vue/Angular/Svelte), ensure simple paths
            let targetPath = filePath;
            const isBlobProject = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"].includes(projectTechStack);
            
            if (isBlobProject && !filePath.startsWith("/home/user/")) {
              // Use simple path for blob-based projects
              targetPath = filePath;
              console.log(`📝 ${projectTechStack} project: Using path ${targetPath}`);
            }
            
            await sandbox.files.write(targetPath, content);
            console.log(`✅ Pre-loaded: ${targetPath} (${content.length} chars)`);
          }
          
          console.log("✅ All existing files successfully pre-loaded into sandbox");
          
          // For blob-based projects, list files to verify
          const isBlobProject = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"].includes(projectTechStack);
          if (isBlobProject) {
            const lsResult = await sandbox.commands.run("ls -la /home/user/*.{html,css,js} 2>/dev/null || echo 'checking...'");
            console.log(`📁 ${projectTechStack} files in /home/user:`, lsResult.stdout);
          }
        } catch (error) {
          console.error("❌ Failed to pre-load existing files:", error);
        }
      }
    });

  // 🧠 Fixed reasoning effort (not user-configurable):
  //   Advanced Reasoning → gpt-6.1-sol, medium | Simple & Fast (all stacks) + App builder → gpt-6.1-terra, low
  const isAppBuild = event.data.isApp === true;
  const agentModel = useAdvancedReasoning ? "gpt-6.1-sol" : "gpt-6.1-terra";
  const reasoningEffort = getReasoningEffort({ isApp: isAppBuild, advancedReasoning: useAdvancedReasoning });
  const reasoningBridgeUrl = getResponsesBridgeBaseUrl(buildId);
  console.log(
    reasoningBridgeUrl
      ? `🧠 ${agentModel} reasoning=${reasoningEffort} (${isAppBuild ? "app" : useAdvancedReasoning ? "advanced" : "simple & fast"}) via ${reasoningBridgeUrl}`
      : `⚠️ No APP_URL / NEXT_PUBLIC_APP_URL / NEXTAUTH_URL set: ${agentModel} running WITHOUT reasoning`
  );

  // 🧪 Automated QA + 🔍 LLM code review + 🌐 real-browser test + 🎨 design review (all stacks)
  const MAX_QA_ROUNDS = 3;
  const STATIC_STACKS = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"];
  const isStaticProject = isAppBuild || STATIC_STACKS.includes(projectTechStack);
  const runStaticQa = isStaticProject;                 // static validator (syntax, handlers, links, ids, audio…)
  const runTypecheckQa = !isStaticProject;             // Next.js: TypeScript check in the sandbox
  const REVIEWER_NAME = "code-reviewer";
  const REVIEW_EFFORT = "medium"; // the reviewer needs to really think through the code
  const MAX_BROWSER_FIX_ROUNDS = 1;
  let qaRounds = 0;
  let reviewQaRounds = 0;
  let reviewDone = false;
  let reviewSummaryText: string | null = null;
  let initialBrowserReport: BrowserQaResult | null = null;
  let browserFixRounds = 0;
  // QA feedback stays in the conversation (inserted right after the summary it refers to);
  // otherwise it would be visible for only one model call and later fixes could forget it.
  type QaFeedback = { afterResults: number; text: string };
  const codeQaFeedback: QaFeedback[] = [];
  const reviewQaFeedback: QaFeedback[] = [];

  const formatResult = (r: AgentResult): Message[] => [...r.output, ...r.toolCalls];
  const injectFeedback = (history: Message[], results: AgentResult[], feedback: QaFeedback[]): Message[] => {
    const h = [...history];
    for (const f of [...feedback].sort((a, b) => b.afterResults - a.afterResults)) {
      const suffixLength = results.slice(f.afterResults).flatMap(formatResult).length;
      h.splice(Math.max(0, h.length - suffixLength), 0, { type: "text", role: "user", content: f.text });
    }
    return h;
  };

  const userRequestText = String(event.data.value || "");
  const looksLikeGameRequest = /\b(game|play|player|level|score|arcade|shooter|puzzle|racing|platformer|rpg|quiz game)\b/i.test(userRequestText);

  // Static validator (static stacks) or TypeScript check (Next.js), returns human-readable issues
  let qaCheckSeq = 0;
  const runQa = async (files: { [path: string]: string }): Promise<string[]> => {
    if (runStaticQa) {
      return validateStaticProject(files || {}, { singleFileApp: isAppBuild, userRequest: userRequestText });
    }
    if (!runTypecheckQa) return [];
    const written = Object.keys(files || {}).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => f.replace(/^\/home\/user\//, ""));
    if (written.length === 0) return [];
    const seq = ++qaCheckSeq;
    const output = await step.run(`typecheck-${seq}`, async () => {
      try {
        const sandbox = await getSandbox(sandboxId);
        const r = await sandbox.commands.run("cd /home/user && timeout 120 npx tsc --noEmit --pretty false -p . 2>&1 | head -120", { timeoutMs: 130_000 });
        return r.stdout || "";
      } catch (e) {
        return (e as { stdout?: string })?.stdout || "";
      }
    });
    const lines = output.split("\n").filter((l) => /error TS\d+/.test(l) && written.some((w) => l.startsWith(w) || l.includes(`/${w}(`)));
    return lines.length ? [`TypeScript errors in files you wrote (fix them all):\n  ${lines.slice(0, 25).join("\n  ")}`] : [];
  };

  // Real-browser test (+ optional design critique) inside the sandbox, memoized as a step
  let browserSeq = 0;
  const runBrowserCheck = async (withDesignReview: boolean): Promise<BrowserQaResult> => {
    const seq = ++browserSeq;
    void tracker.event("browser-testing", withDesignReview ? "Loading the project in Chromium, playing it and taking screenshots" : "Re-testing in the browser");
    const result = await step.run(`browser-qa-${seq}`, async () => {
      const sandbox = await getSandbox(sandboxId);
      return runBrowserQa(sandbox, {
        mode: isStaticProject ? "static" : "next",
        primary: isAppBuild ? "mobile" : "desktop",
        userRequest: userRequestText,
        isGame: looksLikeGameRequest,
        buildId,
        withDesignReview,
      });
    });
    if (result.skipped) console.log(`🌐 Browser QA skipped: ${result.skipped}`);
    else {
      console.log(`🌐 Browser QA #${seq}: ${result.runtimeIssues.length} runtime issue(s)`, result.runtimeIssues);
      if (withDesignReview && result.designNotes) void tracker.event("design-review", result.designNotes.split("\n")[0]);
    }
    return result;
  };

  const makeModel = (effort: string) =>
    reasoningBridgeUrl
      ? // Reasoning tokens via the Responses API bridge
        // (Chat Completions rejects reasoning + function tools on gpt-6 models).
        openai({
          model: agentModel,
          baseUrl: reasoningBridgeUrl,
          defaultParameters: {
            // @ts-ignore - reasoning_effort is not in @inngest/agent-kit types
            reasoning_effort: effort,
          },
        })
      : // Fallback (no public app URL): direct Chat Completions without reasoning
        openai({
          model: agentModel,
          defaultParameters: {
            temperature: useAdvancedReasoning ? 0.5 : 1,
            // @ts-ignore - reasoning_effort is supported by OpenAI but not yet in @inngest/agent-kit types
            reasoning_effort: "none", // Disable reasoning to allow function tools in /v1/chat/completions
          },
        });

  // ✅ OpenAI-powered Agent
  const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      // Web search instructions go FIRST: when appended at the end, the long mobile-app
      // "single pass" prompt made the model skip searching entirely.
      system:
        (webSearchEnabled ? WEB_SEARCH_INSTRUCTIONS + "\n\n" : "") +
        (event.data.isApp === true ? MOBILE_APP_PROMPT : getTechSpecificPrompt(projectTechStack)) +
        "\n\n" + EDIT_TOOL_RULES,
      model: makeModel(reasoningEffort),
      tools: webSearchEnabled
        ? [terminalTool, createOrUpdateFilesTool, editFileTool, readFilesTool, webSearchTool]
        : [terminalTool, createOrUpdateFilesTool, editFileTool, readFilesTool],
      lifecycle: {
        onStart: async ({ prompt, history, network: run }) => {
          const results = run?.state.results ?? [];
          return { prompt, history: injectFeedback(history ?? [], results, codeQaFeedback), stop: false };
        },
        onResponse: async ({ result, network: run }) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);
          if (lastAssistantMessageText?.includes("<task_summary>") && run?.state?.data) {
            // Automated QA: don't accept the build while it has detectable bugs.
            if ((runStaticQa || runTypecheckQa) && qaRounds < MAX_QA_ROUNDS) {
              void tracker.event("checking", "Automated QA");
              const issues = await runQa(run.state.data.files);
              if (issues.length > 0) {
                qaRounds++;
                void tracker.addQaIssues(issues.length);
                void tracker.event("fixing", `Automated QA found ${issues.length} issue(s)`);
                codeQaFeedback.push({ afterResults: run.state.results.length + 1, text: formatValidationFeedback(issues) });
                console.log(`🧪 QA round ${qaRounds}: ${issues.length} issue(s) sent back to the code agent`, issues);
                return result; // summary NOT set -> router runs the code agent again
              }
              console.log("🧪 QA passed");
            }
            run.state.data.summary = lastAssistantMessageText;
          }
          return result;
        },
      },
    });

  // 🔍 Second agent: reviews the finished project like a senior QA engineer and fixes it,
  // guided by a real-browser test (runtime errors) and a design review of screenshots.
  const reviewerAgent = createAgent<AgentState>({
      name: REVIEWER_NAME,
      description: "Reviews the generated project, fixes bugs and polishes UI/UX",
      system: CODE_REVIEWER_PROMPT + "\n\n" + EDIT_TOOL_RULES,
      model: makeModel(REVIEW_EFFORT),
      tools: [createOrUpdateFilesTool, editFileTool, readFilesTool],
      lifecycle: {
        // Focused context: the user's request + test findings + the reviewer's own work
        // (not the builder's whole transcript with every file write, which would waste tokens).
        onStart: async ({ prompt, network: run }) => {
          if (!initialBrowserReport) {
            initialBrowserReport = await runBrowserCheck(true);
            void tracker.event("reviewing", "Reviewer is checking the code");
          }
          const files = Object.keys(run?.state.data.files || {}).filter((f) => !/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(f));
          const stackLabel = isAppBuild ? "mobile web app (single index.html)" : projectTechStack;
          const intro: Message = {
            type: "text",
            role: "user",
            content:
              `USER'S ORIGINAL REQUEST:\n${userRequestText}\n\n` +
              `TECH STACK: ${stackLabel}\n\n` +
              `THE BUILDER AGENT REPORTS:\n${run?.state.data.summary || "(no summary)"}\n\n` +
              `PROJECT FILES: ${files.join(", ")}\n\n` +
              (initialBrowserReport && !initialBrowserReport.skipped ? formatBrowserFindings(initialBrowserReport) + "\n\n" : "") +
              `Review the project now: read every file completely, fix every bug (start with any browser errors above), then address the design review.`,
          };
          const own = (run?.state.results ?? []).filter((r) => r.agentName === REVIEWER_NAME);
          const history = injectFeedback([intro, ...own.flatMap(formatResult)], own, reviewQaFeedback);
          return { prompt, history, stop: false };
        },
        onResponse: async ({ result, network: run }) => {
          const text = lastAssistantTextMessageContent(result);
          if (text?.includes("<review_summary>") && run) {
            const ownCount = () => run.state.results.filter((r) => r.agentName === REVIEWER_NAME).length;
            if (reviewQaRounds < MAX_QA_ROUNDS) {
              void tracker.event("checking", "Automated QA after review");
              const issues = await runQa(run.state.data.files);
              if (issues.length > 0) {
                reviewQaRounds++;
                void tracker.addQaIssues(issues.length);
                void tracker.event("fixing", `Automated QA found ${issues.length} issue(s)`);
                reviewQaFeedback.push({ afterResults: ownCount() + 1, text: formatValidationFeedback(issues) });
                console.log(`🧪 Review QA round ${reviewQaRounds}: ${issues.length} issue(s) sent back to the reviewer`, issues);
                return result;
              }
            }
            // Final real-browser check of the reviewed project: runtime errors go back once
            if (initialBrowserReport && !initialBrowserReport.skipped && browserFixRounds < MAX_BROWSER_FIX_ROUNDS) {
              const final = await runBrowserCheck(false);
              if (!final.skipped && final.runtimeIssues.length > 0) {
                browserFixRounds++;
                void tracker.addQaIssues(final.runtimeIssues.length);
                void tracker.event("fixing", `Browser test found ${final.runtimeIssues.length} problem(s)`);
                reviewQaFeedback.push({ afterResults: ownCount() + 1, text: formatBrowserFindings(final) + "\n\nFix these now (readFiles, then editFile/createOrUpdateFiles), then reply with your <review_summary> again." });
                return result;
              }
            }
            reviewDone = true;
            reviewSummaryText = text;
            console.log("🔍 Code review finished:", text.slice(0, 500));
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent, reviewerAgent],
      // turns for building (+web searches), automated QA fix rounds, and the review pass
      maxIter: (webSearchEnabled ? 14 : 10) + MAX_QA_ROUNDS * 2 + 18,
      defaultState:state,
      router: async ({ network: run }) => {
        if (!run.state.data.summary) return codeAgent;
        const hasFiles = Object.keys(run.state.data.files || {}).length > 0;
        if (hasFiles && !reviewDone) return reviewerAgent;
        return;
      },
    });

    console.log("🚀 Starting agent network with prompt:", event.data.value);
    
    // Check if there are existing files to provide context
    if (previousFiles && Object.keys(previousFiles).length > 0) {
      console.log(`📂 Found existing project files (${Object.keys(previousFiles).length} files)`);
      console.log("📜 Existing files:", Object.keys(previousFiles).join(", "));
    }
    
    // Extract keywords and fetch relevant images
    const keywords = extractKeywords(event.data.value);
    console.log("🔍 Extracted keywords:", keywords);
    
    const imageUrls = await fetchRelevantImages(keywords, 5);
    console.log("🖼️ Fetched images:", imageUrls);
    
    // Download images to sandbox to avoid CORS issues
    const localImagePaths: string[] = [];
    if (imageUrls.length > 0) {
      await step.run("download-images", async () => {
        try {
          const sandbox = await getSandbox(sandboxId);
          
          for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            const imageName = `image-${i + 1}.jpg`;
            
            try {
              console.log(`📥 Downloading image ${i + 1} from: ${imageUrl}`);
              
              // Download image using curl in sandbox with better error handling
              const downloadResult = await sandbox.commands.run(
                `curl -L -f -s -S "${imageUrl}" -o "${imageName}" && echo "SUCCESS" || echo "FAILED"`,
                { timeoutMs: 15000 }
              );
              
              if (!downloadResult.stdout?.includes('SUCCESS')) {
                console.warn(`⚠️ Download failed for image ${i + 1}, skipping...`);
                continue;
              }
              
              // Verify file exists and has content
              const verifyResult = await sandbox.commands.run(
                `ls -lh "${imageName}" && echo "EXISTS"`,
                { timeoutMs: 2000 }
              );
              
              if (!verifyResult.stdout?.includes('EXISTS')) {
                console.warn(`⚠️ Image ${i + 1} not found after download, skipping...`);
                continue;
              }
              
              // Convert to base64 for frontend preview (with error handling)
              const imageBase64Result = await sandbox.commands.run(
                `base64 -w 0 "${imageName}" 2>/dev/null || base64 "${imageName}"`,
                { timeoutMs: 8000 }
              );
              
              if (imageBase64Result.stdout && imageBase64Result.stdout.trim().length > 100) {
                // Store as data URL for easy embedding
                const base64Data = imageBase64Result.stdout.trim();
                
                // Detect image type (jpg by default)
                let mimeType = 'image/jpeg';
                if (imageName.endsWith('.png')) mimeType = 'image/png';
                else if (imageName.endsWith('.gif')) mimeType = 'image/gif';
                else if (imageName.endsWith('.webp')) mimeType = 'image/webp';
                
                if (network.state.data.files) {
                  network.state.data.files[imageName] = `data:${mimeType};base64,${base64Data}`;
                  console.log(`✅ Image ${i + 1} saved as base64 (${Math.round(base64Data.length / 1024)}KB)`);
                }
              } else {
                console.warn(`⚠️ Base64 conversion failed or empty for image ${i + 1}`);
                continue;
              }
              
              localImagePaths.push(imageName);
              console.log(`✅ Successfully processed image ${i + 1}: ${imageName}`);
            } catch (error) {
              console.error(`❌ Failed to process image ${i + 1}:`, error);
            }
          }
          
          console.log(`📊 Final result: ${localImagePaths.length}/${imageUrls.length} images successfully downloaded`);
        } catch (error) {
          console.error("❌ Image download process failed:", error);
        }
      });
    }
    
    // Enhance prompt with local image paths
    let enhancedPrompt = event.data.value;
    
    // Add context about existing files if any
    if (previousFiles && Object.keys(previousFiles).length > 0) {
      const fileList = Object.keys(previousFiles);
      enhancedPrompt = `📂 EXISTING PROJECT CONTEXT:\n`;
      enhancedPrompt += `You are working on an EXISTING project with ${fileList.length} files.\n`;
      enhancedPrompt += `Current files: ${fileList.join(", ")}\n`;
      
      // Special handling for all blob-based projects (HTML, Vue, Angular, Svelte)
      const isBlobProject = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"].includes(projectTechStack);
      if (isBlobProject) {
        const projectTypeLabel = {
          "html-css-js": "HTML/CSS/JS",
          "vue-nuxt": "Vue/Nuxt",
          "angular": "Angular",
          "svelte-kit": "Svelte/SvelteKit"
        }[projectTechStack] || projectTechStack.toUpperCase();
        
        enhancedPrompt += `\n⚠️ ${projectTypeLabel} PROJECT - SPECIAL INSTRUCTIONS:\n`;
        enhancedPrompt += `- All files are in /home/user/ directory\n`;
        enhancedPrompt += `- Use simple filenames: "index.html", "style.css", "app.js"\n`;
        enhancedPrompt += `- NO subdirectories, NO /home/user/ prefix in file paths\n`;
        enhancedPrompt += `- Files are served via HTTP server on port 3000\n`;
        enhancedPrompt += `- Images should use simple filenames: "image-1.jpg", "image-2.jpg"\n`;
        enhancedPrompt += `- When using readFiles or createOrUpdateFiles, use SIMPLE paths only\n\n`;
      }
      
      enhancedPrompt += `\n🔍 EXISTING FILE CONTENTS:\n`;
      enhancedPrompt += `=================================================================\n`;
      
      // Show actual file contents so agent knows what exists
      fileList.forEach(filePath => {
        const content = previousFiles[filePath];
        const preview = content.length > 500 ? content.substring(0, 500) + "...(truncated)" : content;
        enhancedPrompt += `\n📄 FILE: ${filePath}\n`;
        enhancedPrompt += `\`\`\`\n${preview}\n\`\`\`\n`;
      });
      
      enhancedPrompt += `=================================================================\n\n`;
      enhancedPrompt += `⚠️ CRITICAL INSTRUCTIONS FOR MODIFICATIONS:\n`;
      enhancedPrompt += `1. The files shown above ALREADY EXIST in the sandbox\n`;
      enhancedPrompt += `2. The previews above are TRUNCATED. Before changing ANY file you MUST call readFiles on it to get its full current content — never rewrite a file from the preview, or existing features will be lost\n`;
      enhancedPrompt += `3. ONLY modify what the user asked for - keep everything else intact\n`;
      enhancedPrompt += `4. If user says "add sound" or "add feature X", ADD it to existing code\n`;
      enhancedPrompt += `5. DO NOT rebuild from scratch - use createOrUpdateFiles to modify existing files\n`;
      enhancedPrompt += `6. Preserve all existing features, UI, and functionality\n`;
      enhancedPrompt += `7. The existing file paths are: ${fileList.join(", ")}\n`;
      enhancedPrompt += `8. Use these EXACT file paths when reading or updating files\n\n`;
      enhancedPrompt += `=== USER'S NEW REQUEST ===\n${event.data.value}\n\n`;
    }
    
    // Load template HTML if template is selected
    let templateHTML = "";
    if (event.data.templateId) {
      console.log(`🎨 Template selected: ${event.data.templateId}`);
      const template = getTemplateById(event.data.templateId);
      if (template) {
        try {
          const templatePath = path.join(process.cwd(), 'public', template.templateFile);
          templateHTML = fs.readFileSync(templatePath, 'utf-8');
          console.log(`✅ Template HTML loaded: ${template.name} (${templateHTML.length} characters)`);
          
          // Add template HTML to prompt
          enhancedPrompt = `🎨 BASE TEMPLATE PROVIDED:\n`;
          enhancedPrompt += `You have been given a complete HTML template as a starting point.\n`;
          enhancedPrompt += `Your task is to MODIFY this template based on user requirements while keeping the design structure.\n\n`;
          enhancedPrompt += `=== TEMPLATE HTML ===\n${templateHTML}\n=== END TEMPLATE ===\n\n`;
          enhancedPrompt += `📋 MODIFICATION INSTRUCTIONS:\n`;
          enhancedPrompt += `1. Keep the overall design structure, colors, and layout from the template\n`;
          enhancedPrompt += `2. Update text content based on user requirements below\n`;
          enhancedPrompt += `3. Modify sections as needed but maintain the template's aesthetic\n`;
          enhancedPrompt += `4. Replace placeholder content with user-specific content\n`;
          enhancedPrompt += `5. Keep all CSS styling intact unless user specifically asks to change design\n\n`;
          enhancedPrompt += `⚠️ CRITICAL: SINGLE PAGE APPLICATION - NO SEPARATE PAGES!\n`;
          enhancedPrompt += `- ALL navigation links MUST use anchor links (#section-id) for smooth scrolling\n`;
          enhancedPrompt += `- Example: <a href="#features">Features</a> NOT <a href="features.html">\n`;
          enhancedPrompt += `- All sections must be on the SAME HTML page\n`;
          enhancedPrompt += `- Add smooth scroll CSS: html { scroll-behavior: smooth; }\n`;
          enhancedPrompt += `- Use IDs for sections: <section id="features">, <section id="pricing">, etc.\n\n`;
          enhancedPrompt += `=== USER REQUIREMENTS ===\n${event.data.value}\n\n`;
        } catch (error) {
          console.error(`❌ Failed to load template HTML:`, error);
        }
      }
    }
    
    // Stock photos are OPTIONAL material. (Previously they were "MANDATORY" with a fixed
    // hero/features/gallery layout, which turned every request — even games and tools —
    // into the same generic landing page.)
    if (localImagePaths.length > 0) {
      enhancedPrompt += `\n\n---\nOPTIONAL STOCK PHOTOS (already downloaded; use them ONLY where they genuinely fit what the user asked for):\n`;
      localImagePaths.forEach((_p, index) => {
        enhancedPrompt += `- "image-${index + 1}.jpg"\n`;
      });
      enhancedPrompt += `They were found by a keyword search, so they may be irrelevant. Ignore them for games, tools, utilities, dashboards or anything where photos don't belong — never add a hero banner or gallery just to use them. If used: <img src="image-1.jpg" alt="..."> (plain filename, no ./ or / prefix).\n`;
      console.log(`📝 Offered ${localImagePaths.length} optional stock images`);
    } else {
      console.log("📝 No images downloaded, proceeding without images");
    }

    if (event.data.isApp === true && (!previousFiles || Object.keys(previousFiles).length === 0)) {
      enhancedPrompt += `\n\n---\nFIRST BUILD: deliver the complete app in this pass inside index.html — every screen this app needs (decided from its purpose, not a fixed template), all fully working. No placeholder screens or "coming soon".`;
    }

    // 📚 Knowledge: the user's standing instructions (workspace-wide + this project)
    const knowledgeBlock = formatKnowledgeBlock(knowledge);
    if (knowledgeBlock) enhancedPrompt = knowledgeBlock + "\n\n" + enhancedPrompt;

    // Supabase backend (if the user connected one): real auth + database instead of localStorage
    if (supabase && isStaticProject) {
      enhancedPrompt += "\n\n" + supabaseBackendRules(supabase.url, supabase.anonKey);
    }

    void tracker.event("planning", previousFiles && Object.keys(previousFiles).length > 0 ? "Updating your project" : "Planning your project");
    let result;
    try {
      result = await network.run(enhancedPrompt,{ state });
    } catch (error) {
      console.error("❌ Agent network execution failed:", error);
      throw error;
    }

    // Log the result for debugging
    console.log("Agent execution completed");
    console.log("Summary:", result.state.data.summary ? "Generated" : "Empty");
    console.log("Files count:", Object.keys(result.state.data.files || {}).length);
    
    if (!result.state.data.summary) {
      console.error("❌ No summary generated by agent!");
    }
    if (Object.keys(result.state.data.files || {}).length === 0) {
      console.error("❌ No files generated by agent!");
    }

  const fragmentTitleGenerator=createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      // Short title / reply after each build: Terra with reasoning off (fast, on the free allowance)
      model: openai({
        model: "gpt-6.1-terra",
        defaultParameters: {
          // @ts-ignore - reasoning_effort is not in @inngest/agent-kit types
          reasoning_effort: "none",
        },
      }),
    });

  const responseGenerator=createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      // Short title / reply after each build: Terra with reasoning off (fast, on the free allowance)
      model: openai({
        model: "gpt-6.1-terra",
        defaultParameters: {
          // @ts-ignore - reasoning_effort is not in @inngest/agent-kit types
          reasoning_effort: "none",
        },
      }),
    });

    // Title generator sees the user's actual request (not only the summary) so names like
    // "use web search and create ..." become a real title instead of "Use Web".
    const summaryText = result.state.data.summary || "";
    const {
      output: fragmentTitleOutput
     }= await fragmentTitleGenerator.run(
       `User request: ${String(event.data.value || "").slice(0, 1000)}\n\n${summaryText}`
     );
    const {
      output: responseOutput
     }= await responseGenerator.run(summaryText || "The task could not be completed.");

     // Safely read the first text message from an agent's output (output may be empty)
     const firstText = (output: Message[]): string | null => {
       const msg = output.find((m) => m.type === "text");
       if (!msg || msg.type !== "text") return null;
       const text = Array.isArray(msg.content) ? msg.content.map((c) => c.text).join("") : msg.content;
       return text?.trim() || null;
     };

     const generateFragmentTitle = () => {
       const raw = firstText(fragmentTitleOutput);
       if (!raw) return "Fragment";
       const cleaned = raw
         .replace(/^title\s*:\s*/i, "")
         .replace(/["'`*_#<>]/g, "")
         .replace(/\s+/g, " ")
         .trim()
         .split(" ")
         .slice(0, 4)
         .join(" ")
         .slice(0, 40)
         .trim();
       return cleaned || "Fragment";
     };

     const generateResponse = () => firstText(responseOutput) || "Here you go";


    const isError =
  !result.state.data.summary &&
  Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      
      // For all blob-based projects, start a simple HTTP server
      const isBlobProject = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"].includes(projectTechStack);
      if (isBlobProject) {
        try {
          // Check if files exist in home directory
          const lsResult = await sandbox.commands.run("ls -la /home/user/*.html 2>/dev/null || echo 'no-files'");
          console.log(`📁 ${projectTechStack} files in /home/user:`, lsResult.stdout);
          
          // Install http-server globally if not present
          await sandbox.commands.run("npm install -g http-server 2>/dev/null || true", { timeoutMs: 30000 });
          
          // Kill any existing http-server process
          await sandbox.commands.run("pkill -f http-server || true");
          
          // Change to home directory and start HTTP server
          await sandbox.commands.run(
            "cd /home/user && nohup http-server -p 3000 --cors -c-1 -d false > /tmp/server.log 2>&1 &",
            { timeoutMs: 5000 }
          );
          
          console.log("✅ HTTP server started on port 3000 in /home/user");
          
          // Wait for server to start
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify server is running
          const psResult = await sandbox.commands.run("ps aux | grep http-server | grep -v grep || echo 'not-running'");
          console.log("🔍 Server status:", psResult.stdout);
        } catch (error) {
          console.error("❌ Failed to start HTTP server:", error);
        }
      }
      
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    // Project names are AI-generated at creation (src/lib/project-naming.ts) and users can
    // rename them with the pencil button, so the build never renames the project.

    void tracker.event("saving", "Saving the new version");

     await step.run("save-result", async () => {
      const isApp = event.data.isApp === true;

      if (isApp) {
        if (isError) {
          return await prisma.appMessage.create({
            data: {
              appProjectId: event.data.projectId,
              content: "Something went wrong and nothing was generated. Your credit has been refunded — please try again.",
              role: "ASSISTANT",
              type: "ERROR",
            },
          });
        }
        
        return prisma.appMessage.create({
          data: {
            appProjectId: event.data.projectId,
            content: generateResponse(),
            role: "ASSISTANT",
            type: "RESULT",
            fragments: {
              create: {
                sandboxUrl: sandboxUrl,
                title: generateFragmentTitle(),
                files: result.state.data.files as any,
              },
            },
          },
        });
      } else {
        if (isError) {
          // Only show error if both summary and files are missing
          return await prisma.message.create({
            data: {
              projectId: event.data.projectId,
              content: "Something went wrong and nothing was generated. Your credit has been refunded — please try again.",
              role: "ASSISTANT",
              type: "ERROR",
            },
          });
        }
        
        return prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: generateResponse(),
            role: "ASSISTANT",
            type: "RESULT",
            fragments: {
              create: {
                sandboxUrl: sandboxUrl,
                title: generateFragmentTitle(),
                files: result.state.data.files,
              },
            },
          },
        });
      }
    });

    // Nothing was produced: refund the credit (after the ERROR message is saved, so the
    // onFailure handler won't refund a second time).
    if (isError) {
      await step.run("refund-credit", async () => {
        const isApp = event.data.isApp === true;
        const ownerId = await getProjectOwnerId(event.data.projectId, isApp);
        if (ownerId) await refundCredit(ownerId, event.data.creditCost ?? (isApp ? 5 : 1));
      });
    }

    await tracker.event(isError ? "failed" : "done", isError ? "Nothing was generated" : "Your project is ready");
    await tracker.finish(isError ? "failed" : "succeeded", {
      reviewSummary: reviewSummaryText,
      error: isError ? "No summary and no files generated" : null,
    });

    // 💸 Static projects are previewed/published from the saved files, so the sandbox isn't
    // needed after the build — shut it down now instead of letting it idle for 30 minutes.
    if (isStaticProject) {
      await step.run("shutdown-sandbox", async () => {
        try {
          await Sandbox.kill(sandboxId);
        } catch (e) {
          console.warn("⚠️ Could not shut down sandbox:", e);
        }
      });
    }

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);