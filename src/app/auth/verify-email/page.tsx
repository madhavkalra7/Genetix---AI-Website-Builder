"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "idle" | "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "idle" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is missing its token.");
  // Errors that keep the form usable (e.g. wrong password): the token is only consumed on success.
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || status === "verifying") return;
    setStatus("verifying");
    setFormError(null);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = data.error || "Failed to verify email";
        // Wrong password or rate limit: let the user try again with the same link.
        if (response.status === 429 || /password/i.test(error)) {
          setStatus("idle");
          setFormError(error);
          return;
        }
        setStatus("error");
        setMessage(error);
        return;
      }
      setStatus("success");
      setMessage(data.message || "Your email has been verified. You can now sign in.");
    } catch {
      setStatus("idle");
      setFormError("Network error. Please try again.");
    }
  };

  return (
    <div className="text-center space-y-6">
      {(status === "idle" || status === "verifying") && (
        <>
          <div className="text-5xl">✉️</div>
          <h1 className="text-3xl font-bold font-[Orbitron] bg-gradient-to-r from-white via-purple-300 to-blue-300 bg-clip-text text-transparent">
            Confirm your email
          </h1>
          <p className="text-white/60 text-sm">
            Enter the password you chose when signing up to finish verifying your email.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <Label htmlFor="password" className="text-white/80 font-[Orbitron]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/40 border-white/30 text-white mt-1"
                placeholder="Enter the password you chose when signing up"
              />
            </div>
            {formError && (
              <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p>
            )}
            <Button
              type="submit"
              disabled={status === "verifying" || !password}
              className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg"
            >
              {status === "verifying" ? "Verifying..." : "Verify email"}
            </Button>
          </form>
          <p className="text-white/50 text-xs">
            Didn&apos;t sign up for Genetix? You can ignore this link, or{" "}
            <Link href="/auth/signup" className="underline hover:text-purple-300">
              sign up again
            </Link>{" "}
            with your own password.
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="text-5xl">✅</div>
          <h1 className="text-3xl font-bold font-[Orbitron] bg-gradient-to-r from-white via-purple-300 to-blue-300 bg-clip-text text-transparent">
            Email Verified
          </h1>
          <p className="text-white/70 text-sm">{message}</p>
          <Button asChild className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg">
            <Link href="/auth/signin">Sign In 🚀</Link>
          </Button>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-5xl">⚠️</div>
          <h1 className="text-3xl font-bold font-[Orbitron] bg-gradient-to-r from-white via-purple-300 to-blue-300 bg-clip-text text-transparent">
            Verification Failed
          </h1>
          <p className="text-white/70 text-sm">{message}</p>
          <p className="text-white/50 text-xs">
            You can request a new link by trying to sign in and choosing &quot;Resend verification email&quot;.
          </p>
          <Button asChild className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg">
            <Link href="/auth/signin">Go to Sign In</Link>
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      {/* Cosmic Background */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-blue-900/20" />
        <div className="stars absolute inset-0" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="backdrop-blur-md bg-black/40 border border-white/20 rounded-3xl p-8 shadow-2xl">
            <Suspense fallback={<p className="text-center text-white/60 font-[Orbitron]">Loading...</p>}>
              <VerifyEmailContent />
            </Suspense>
          </div>
        </div>
      </div>

      <style jsx>{`
        .stars {
          background-image:
            radial-gradient(2px 2px at 20% 30%, white, transparent),
            radial-gradient(2px 2px at 60% 70%, white, transparent),
            radial-gradient(1px 1px at 50% 50%, white, transparent),
            radial-gradient(1px 1px at 80% 10%, white, transparent),
            radial-gradient(2px 2px at 90% 60%, white, transparent),
            radial-gradient(1px 1px at 33% 80%, white, transparent);
          background-size: 200% 200%;
          animation: twinkle 8s ease-in-out infinite;
          opacity: 0.5;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </main>
  );
}
