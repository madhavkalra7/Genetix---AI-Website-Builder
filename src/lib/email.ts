import nodemailer from 'nodemailer';

/**
 * Small reusable SMTP sender. Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 * (same variables the subscription credit-request mail uses) and optionally SMTP_FROM.
 */

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Public base URL of the app, used to build links in emails. */
export function getAppUrl(): string {
  const url =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Sends an email via SMTP. Throws if SMTP is not configured or sending fails. */
export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }

  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Genetix" <${process.env.SMTP_USER}>`,
    to,
    subject: subject.replace(/[\r\n]/g, ' '),
    text,
    html,
  });
}

export function buildVerificationUrl(token: string): string {
  return `${getAppUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export type VerificationEmailResult = 'sent' | 'logged' | 'unavailable';

/**
 * Sends the email-verification link.
 * - SMTP configured: sends the email (throws on SMTP failure).
 * - No SMTP in development: logs the link to the server console ("logged").
 * - No SMTP in production: returns "unavailable"; callers must refuse signup.
 */
export async function sendVerificationEmail(to: string, token: string): Promise<VerificationEmailResult> {
  const url = buildVerificationUrl(token);

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email] SMTP not configured. Verification link for ${to}: ${url}`);
      return 'logged';
    }
    return 'unavailable';
  }

  await sendEmail({
    to,
    subject: 'Verify your email for Genetix',
    text:
      `Welcome to Genetix!\n\nPlease confirm your email address by opening this link:\n${url}\n\n` +
      `The link expires in 24 hours. If you did not create a Genetix account, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #a855f7;">Confirm your email</h2>
        <p>Welcome to Genetix! Please confirm your email address to activate your account.</p>
        <a href="${url}"
           style="display: inline-block; padding: 10px 20px; background-color: #a855f7; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Verify email
        </a>
        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          The link expires in 24 hours. If you did not create a Genetix account, you can ignore this email.
        </p>
      </div>
    `,
  });
  return 'sent';
}
