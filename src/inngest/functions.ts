import { inngest } from "./client";
import { createAgent, createTool, createNetwork, type Tool, openai, type Message, createState } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { z } from "zod";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { FRAGMENT_TITLE_PROMPT, getTechSpecificPrompt, RESPONSE_PROMPT} from "@/prompt";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "./types";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
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
      const sandbox = await Sandbox.create("htrjn0k08ekwyjfwkcpo");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });

    const { previousMessages, projectTechStack } = await step.run("get-project-data", async () => {
      const formattedMessages:Message[]=[];

      // Get project info including techStack
      const project = await prisma.project.findUnique({
        where: { id: event.data.projectId },
        select: { techStack: true }
      });

      const messages=await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take:5,
      });
      for(const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role==="ASSISTANT" ? "assistant" : "user",
          content: message.content,
        });
      }
      return {
        previousMessages: formattedMessages.reverse(),
        projectTechStack: project?.techStack || "react-nextjs"
      };
    });

    const state=createState<AgentState>(
      {
      summary:"",
      files:{},
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

    const createOrUpdateFilesTool = createTool({
      name: "createOrUpdateFiles",
      description: "Create or Update files in the sandbox",
      parameters: createOrUpdateFilesSchema,
      handler: async ({ files }, { step, network }) => {
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
        }
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

  // ✅ OpenRouter-powered Agent
  const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: getTechSpecificPrompt(projectTechStack),
      model: openai({
    // baseUrl: "https://openrouter.ai/api/v1",
    // apiKey: process.env.OPENROUTER_API_KEY!,
    model: "gpt-5-mini-2025-08-07",
    // defaultParameters:{
    //   temperature:0.3,
    // },
      }),   
      tools: [terminalTool, createOrUpdateFilesTool, readFilesTool],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);
          if (lastAssistantMessageText?.includes("<task_summary>")) {
            if (network?.state?.data) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 10,
      defaultState:state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) return;
        return codeAgent;
      },
    });

    console.log("🚀 Starting agent network with prompt:", event.data.value);
    let result;
    try {
      result = await network.run(event.data.value,{ state });
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
      model: openai({
    model: "gpt-5-mini-2025-08-07",
      }),
    });

  const responseGenerator=createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({
    model: "gpt-5-mini-2025-08-07",
      }),
    });

    const { 
      output: fragmentTitleOutput
     }= await fragmentTitleGenerator.run(result.state.data.summary);
    const { 
      output: responseOutput
     }= await responseGenerator.run(result.state.data.summary);

     const generateFragmentTitle = () => {
      const output=fragmentTitleOutput[0];
       if (output.type !== "text") {
         return "Fragment";
       }
       if(Array.isArray(output.content)){
        return output.content.map((txt)=>txt).join("")
       } else{
        return output.content;
       }
     };

     const generateResponse = () => {
      const output=responseOutput[0];
       if (output.type !== "text") {
         return "Here you go";
       }
       if(Array.isArray(output.content)){
        return output.content.map((txt)=>txt).join("")
       } else{
        return output.content;
       }
     };


    const isError =
  !result.state.data.summary &&
  Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      
      // For all projects, use the standard sandbox URL
      // HTML/CSS/JS preview will be handled by the frontend component
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        // Only show error if both summary and files are missing
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something Went Wrong. No summary and no files generated.",
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
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);