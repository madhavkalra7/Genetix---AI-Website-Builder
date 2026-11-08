import { redirect } from "next/navigation";

// Legacy OAuth-only sign-in page: everything now lives at /auth/signin.
// Forward ?redirect= / ?callbackUrl= so deep links keep working (relative paths only, no open redirect).

const FORWARDED_PARAMS = ["redirect", "callbackUrl"] as const;

function isSafeRelativePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

export default async function LegacySignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const name of FORWARDED_PARAMS) {
    const raw = params[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && isSafeRelativePath(value)) query.set(name, value);
  }
  const qs = query.toString();
  redirect(qs ? `/auth/signin?${qs}` : "/auth/signin");
}
