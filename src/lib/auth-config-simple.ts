import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db";
import { isEmailVerified, deleteAllUserSessions } from "@/lib/auth";
import { cookies } from "next/headers";
import { REFERRAL_COOKIE } from "@/lib/referrals";
import { applyReferralForNewUser, grantReferralRewardIfEligible } from "@/modules/referrals/server/service";

/**
 * The signup page stores ?ref=<code> in the gx_ref cookie so it survives the OAuth round trip.
 * The NextAuth callback runs inside the /api/auth/[...nextauth] route handler, where
 * next/headers cookies() is available. Returns null if the cookie is missing/unreadable.
 */
async function readReferralCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(REFERRAL_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Create user in database if they don't exist
      if (user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          });

          if (!existingUser) {
            console.log("Creating new OAuth user:", user.email);
            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                username: user.email.split('@')[0],
                firstName: user.name || user.email.split('@')[0],
                image: user.image,
                emailVerified: true, // OAuth emails are verified
              }
            });

            // Create Account record for OAuth link
            if (account) {
              await prisma.account.create({
                data: {
                  userId: newUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state as string | null,
                }
              });
            }
            console.log("✅ OAuth user created successfully");

            // Referral: OAuth proves the email, so attach + reward right away. Never blocks login.
            const referralCode = await readReferralCookie();
            if (referralCode) {
              await applyReferralForNewUser(newUser.id, referralCode);
            }
          } else {
            console.log("OAuth user already exists:", user.email);

            // SECURITY (account-hijack fix): an unverified credentials account with this email
            // may have been registered by someone who doesn't own the address. The OAuth provider
            // has now proven ownership, so mark the email verified, drop the password set at
            // signup and kill every existing session before letting the real owner in.
            // Legacy users (created before EMAIL_VERIFICATION_CUTOFF) count as verified and are
            // left untouched, as before.
            if (!isEmailVerified(existingUser)) {
              console.warn("Unverified account claimed via OAuth; clearing password and sessions:", existingUser.id);
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { emailVerified: true, passwordHash: null },
              });
              await deleteAllUserSessions(existingUser.id);
              await prisma.verificationToken.deleteMany({
                where: { userId: existingUser.id, type: "EMAIL_VERIFICATION" },
              });
              // The email is now proven: pay out a referral recorded at credentials signup.
              await grantReferralRewardIfEligible(existingUser.id);
            }

            // Update user image if changed
            if (user.image && existingUser.image !== user.image) {
              await prisma.user.update({
                where: { email: user.email },
                data: { image: user.image }
              });
            }
          }
        } catch (error) {
          console.error("❌ Error creating OAuth user:", error);
          return false;
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to home after successful OAuth
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production", // debug logs include OAuth tokens/profile data
};
