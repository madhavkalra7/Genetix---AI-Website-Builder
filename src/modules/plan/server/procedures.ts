import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { isAiquestUser } from "@/lib/aiquest";
import { runPlanChat } from "./plan-chat";

export const planRouter = createTRPCRouter({
  /** Plan / Chat mode: one cheap chat reply, no build, no credits. */
  chat: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        message: z
          .string()
          .trim()
          .min(1, { message: "Message is required" })
          .max(4000, { message: "Message is too long (max 4000 characters)" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (await isAiquestUser(ctx.auth.userId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Plan mode is unavailable in World 6." });
      }
      return runPlanChat({ projectId: input.projectId, userId: ctx.auth.userId, message: input.message });
    }),
});
