import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-config-simple";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

// Force Node.js runtime for NextAuth
export const runtime = "nodejs";
