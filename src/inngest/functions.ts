import { inngest } from "./client";
import { createAgent, createTool, createNetwork, type Tool, openai, type Message, createState } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { z } from "zod";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { FRAGMENT_TITLE_PROMPT, getTechSpecificPrompt, RESPONSE_PROMPT} from "@/prompt";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "./types";
import { extractKeywords, fetchRelevantImages } from "@/lib/image-fetcher";
import { getTemplateById } from "@/lib/templates";
import fs from "fs";
import path from "path";

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

    const { previousMessages, projectTechStack, previousFiles, useAdvancedReasoning } = await step.run("get-project-data", async () => {
      const formattedMessages:Message[]=[];

      // Get project info including techStack and advancedReasoning flag
      const project = await prisma.project.findUnique({
        where: { id: event.data.projectId },
        select: { techStack: true, advancedReasoning: true }
      });

      // Get ALL messages for complete conversation history (not just 5)
      const messages=await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        include: {
          fragments: true, // Include fragments to get previous code
        },
        orderBy: {
          createdAt: "asc", // Get in chronological order
        },
      });
      
      // Get the most recent fragment to provide current code context
      const latestFragment = await prisma.fragment.findFirst({
        where: {
          message: {
            projectId: event.data.projectId,
          }
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          files: true,
        }
      });

      for(const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role==="ASSISTANT" ? "assistant" : "user",
          content: message.content,
        });
      }
      
      return {
        previousMessages: formattedMessages,
        projectTechStack: project?.techStack || "react-nextjs",
        previousFiles: (latestFragment?.files as { [path: string]: string }) || {},
        useAdvancedReasoning: project?.advancedReasoning || false
      };
    });

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

  // ✅ OpenRouter-powered Agent
  const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: getTechSpecificPrompt(projectTechStack),
      model: openai({
    // Dynamically choose model based on advancedReasoning flag
    // GPT-5.1 for advanced reasoning (24h limit), GPT-5-mini for standard (fast & efficient)
    model: useAdvancedReasoning ? "gpt-5.1-2025-11-13" : "gpt-5-mini-2025-08-07",
    defaultParameters:{
      temperature: useAdvancedReasoning ? 0.5 : 1, // Slightly higher temp for reasoning
    },
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
      enhancedPrompt += `2. You can use readFiles(['${fileList[0]}']) to see the complete current version\n`;
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
    
    if (localImagePaths.length > 0) {
      enhancedPrompt += `\n\n🎨 CRITICAL REQUIREMENT - YOU MUST USE THESE HIGH-QUALITY IMAGES:\n`;
      enhancedPrompt += `=================================================================\n`;
      localImagePaths.forEach((path, index) => {
        const simplePath = `image-${index + 1}.jpg`;
        enhancedPrompt += `✓ Image ${index + 1}: "${simplePath}" (already downloaded, ready to use)\n`;
      });
      enhancedPrompt += `\n📋 MANDATORY IMAGE INTEGRATION INSTRUCTIONS:\n`;
      enhancedPrompt += `1. Hero Section: Use "image-1.jpg" as the main hero/banner image\n`;
      enhancedPrompt += `2. Content Sections: Use "image-2.jpg" and "image-3.jpg" for feature showcases\n`;
      enhancedPrompt += `3. Gallery/Background: Use "image-4.jpg" and "image-5.jpg" for additional visuals\n\n`;
      enhancedPrompt += `⚠️ CRITICAL HTML SYNTAX:\n`;
      enhancedPrompt += `<img src="image-1.jpg" alt="Hero banner">\n`;
      enhancedPrompt += `<img src="image-2.jpg" alt="Feature showcase">\n`;
      enhancedPrompt += `(NO ./ prefix, NO / prefix - just the filename!)\n\n`;
      enhancedPrompt += `📐 REQUIRED CSS for responsive images:\n`;
      enhancedPrompt += `img { max-width: 100%; height: auto; display: block; }\n`;
      enhancedPrompt += `=================================================================\n`;
      enhancedPrompt += `YOU MUST include ALL ${localImagePaths.length} images in the website design!\n\n`;
      console.log(`📝 Enhanced prompt with ${localImagePaths.length} local images (MANDATORY USAGE)`);
    } else {
      console.log("📝 No images downloaded, proceeding without images");
    }
    
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