import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { codeAgentFunction } from "@/inngest/functions";
import { quickEditFunction } from "@/inngest/quick-edit";
import { challengesCronFunction } from "@/inngest/challenges";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    codeAgentFunction, // full build pipeline
    quickEditFunction, // ⚡ fast targeted edits (click-to-edit)
    challengesCronFunction, // hourly: weekly challenge rotation + prize payouts
  ],
});
