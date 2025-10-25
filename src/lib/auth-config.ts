import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { Adapter } from "next-auth/adapters";

declare module "next-auth" {
  interface User {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    emailVerified?: boolean | null;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      emailVerified?: boolean | null;
    };
  }
}

export const authOptions: NextAuthOptions = {
  // Remove adapter for JWT strategy - OAuth will work without database sessions
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Account is disabled");
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.username || user.email,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  debug: true, // Force enable debug logs
  logger: {
    error(code, metadata) {
      console.error("❌ NextAuth Error Code:", code);
      console.error("❌ NextAuth Error Metadata:", JSON.stringify(metadata, null, 2));
    },
    warn(code) {
      console.warn("⚠️ NextAuth Warning:", code);
    },
    debug(code, metadata) {
      console.log("🔍 NextAuth Debug:", code, JSON.stringify(metadata, null, 2));
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("🔵 signIn callback triggered");
      console.log("Provider:", account?.provider);
      console.log("User email:", user.email);
      
      // For OAuth providers, create or update user in database manually
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          console.log("🔍 Processing OAuth sign in for:", account.provider);
          
          // Check if user exists
          let existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { subscription: true },
          });

          console.log("Existing user found:", !!existingUser);

          const firstName = (profile as any)?.given_name || (profile as any)?.name?.split(" ")[0] || "";
          const lastName = (profile as any)?.family_name || (profile as any)?.name?.split(" ")[1] || "";

          // Create user if doesn't exist
          if (!existingUser) {
            console.log("Creating new user...");
            existingUser = await prisma.user.create({
              data: {
                email: user.email!,
                firstName: firstName,
                lastName: lastName,
                image: user.image,
                emailVerified: true,
                username: user.email!.split('@')[0],
              },
              include: { subscription: true },
            });
            console.log("✅ User created:", existingUser.id);
          } else {
            console.log("Updating existing user...");
            // Update existing user
            existingUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                firstName: firstName || existingUser.firstName,
                lastName: lastName || existingUser.lastName,
                image: user.image || existingUser.image,
                emailVerified: true,
              },
              include: { subscription: true },
            });
            console.log("✅ User updated:", existingUser.id);
          }

          // Create free subscription if user doesn't have one
          if (!existingUser.subscription) {
            console.log("Creating free subscription...");
            const freePlan = await prisma.plan.findFirst({
              where: { name: "FREE" },
            });

            if (freePlan) {
              await prisma.subscription.create({
                data: {
                  userId: existingUser.id,
                  planId: freePlan.id,
                  status: "ACTIVE",
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                },
              });
              console.log("✅ Free subscription created");
            } else {
              console.warn("⚠️ FREE plan not found in database");
            }
          }

          // Store user ID for JWT
          user.id = existingUser.id;
          console.log("✅ OAuth signIn successful for user:", user.id);
          return true;
          
        } catch (error) {
          console.error("❌ OAuth signIn error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          return false;
        }
      }
      
      console.log("✅ signIn callback returning true");
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        
        // Fetch fresh user data
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            image: true,
            emailVerified: true,
          },
        });

        if (dbUser) {
          session.user = {
            ...session.user,
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            image: dbUser.image,
            emailVerified: dbUser.emailVerified,
          };
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
