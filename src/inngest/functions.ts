import { inngest } from "./client";
import { createAgent, createTool, createNetwork, type Tool, openai, type Message, createState } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { z } from "zod";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { FRAGMENT_TITLE_PROMPT, PROMPT , RESPONSE_PROMPT} from "@/prompt";
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
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("htrjn0k08ekwyjfwkcpo");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });

    const previousMessages=await step.run("get-previous-messages", async () => {
      const formattedMessages:Message[]=[];

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
      return formattedMessages.reverse();
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

  // ✅ OpenRouter-powered Agent
  const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
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
      maxIter: 8,
      defaultState:state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) return;
        return codeAgent;
      },
    });

    const result = await network.run(event.data.value,{ state });

  const fragmentTitleGenerator=createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
    model: "gpt-5-nano-2025-08-07",
      }),
    });

  const responseGenerator=createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({
    model: "gpt-5-nano-2025-08-07",
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
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something Went Wrong. Please try again.",
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