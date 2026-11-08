import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";

export const subscriptionRouter = createTRPCRouter({
  // Get current user's subscription
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    return subscription;
  }),

  // Get user's payment history
  getMyPayments: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return payments;
  }),

  // Check if user has active subscription
  hasActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: {
          gte: new Date(),
        },
      },
    });

    return !!subscription;
  }),

  // Request credits for a plan (stores in database & sends email to admin)
  requestCredits: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        planName: z.string().trim().min(1).max(60)
      })
    )
    .mutation(async ({ input, ctx }) => {
      // SECURITY: credits are granted to the request's email on approval, so always use the
      // logged-in account's email (never a client-supplied one), and escape values put into HTML.
      const me = await prisma.user.findUnique({ where: { id: ctx.auth.userId }, select: { email: true } });
      if (!me?.email) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      const requestEmail = me.email;
      const requestPlan = input.planName;
      const safeEmail = escapeHtml(requestEmail);
      const safePlan = escapeHtml(requestPlan);

      // 1. Save request in database
      const createdRequest = await prisma.creditRequest.create({
        data: {
          email: requestEmail,
          planName: requestPlan,
          status: "PENDING"
        }
      });

      // 2. Try sending email using Nodemailer
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });

          await transporter.sendMail({
            from: `"Genetix Credit Manager" <${smtpUser}>`,
            to: "madhavkalra2005@gmail.com",
            subject: `🚨 [CREDIT REQUEST] New subscription request for ${requestPlan.replace(/[\r\n]/g, " ")}`,
            text: `Hello Madhav,\n\nA user has requested credits after selecting a subscription plan.\n\nUser Email: ${requestEmail}\nPlan Selected: ${requestPlan}\n\nYou can approve this request from the Admin Dashboard at: /admin-create-user\n\nBest,\nGenetix Team`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #a855f7;">🚨 New Credit Request Received</h2>
                <p>Hello Madhav,</p>
                <p>A user has requested credits after selecting a subscription plan.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User Email</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${safeEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Plan Selected</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${safePlan}</td>
                  </tr>
                </table>
                <p>You can review and approve this request instantly from your admin dashboard:</p>
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin-create-user" 
                   style="display: inline-block; padding: 10px 20px; background-color: #a855f7; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Go to Admin Dashboard
                </a>
                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
                <p style="font-size: 11px; color: #666;">This is an automated notification from Genetix website builder.</p>
              </div>
            `
          });
          console.log(`✅ Credit request email sent successfully to madhavkalra2005@gmail.com`);
        } catch (mailError) {
          console.error(`❌ Failed to send credit request email:`, mailError);
        }
      } else {
        console.warn(`⚠️ SMTP variables not fully configured. Credit request saved in database but email not sent.`);
      }

      return createdRequest;
    })
});
