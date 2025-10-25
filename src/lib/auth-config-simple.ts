import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db";

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
          } else {
            console.log("OAuth user already exists:", user.email);
            
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
  debug: true,
};
