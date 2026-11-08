"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "idle" | "submitting" | "success" | "error";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>(token ? "idle" : "error");
  const [message, setMessage] = useState(token ? "" : "This reset link is missing its token.");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || status === "submitting") return;
    setFormError(null);
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords don't match.");
      return;
    }
    setStatus("submitting");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = data.error || "Failed to reset password";
        if (/invalid or has expired/i.test(error)) {
          setStatus("error");
          setMessage(error);
        } else {
          setStatus("idle");
          setFormError(error);
        }
        return;
      }
      setStatus("success");
      setMessage(data.message || "Your password has been reset. You can now sign in.");
    } catch {
      setStatus("idle");
      setFormError("Network error. Please try again.");
    }
  };

  if (status === "success" || status === "error") {
    const ok = status === "success";
    return (
      <div className="text-center space-y-6">
        <div className="text-5xl">{ok ? "✅" : "⚠️"}</div>
        <h1 className="text-3xl font-bold font-[Orbitron] bg-gradient-to-r from-white via-purple-300 to-blue-300 bg-clip-text text-transparent">
          {ok ? "Password Reset" : "Link Not Valid"}
        </h1>
        <p className="text-white/70 text-sm">{message}</p>
        <Button asChild className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg">
          <Link href={ok ? "/auth/signin" : "/auth/forgot-password"}>{ok ? "Sign In 🚀" : "Request a new link"}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold font-[Orbitron] mb-2 bg-gradient-to-r from-white via-purple-300 to-blue-300 bg-clip-text text-transparent">
          New Password
        </h1>
        <p className="text-white/60 font-[Orbitron] text-sm">Choose a new password for your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="password" className="text-white/80 font-[Orbitron]">
            New password
          </Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-black/40 border-white/30 text-white mt-1"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="confirm" className="text-white/80 font-[Orbitron]">
            Confirm password
          </Label>
          <Input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="bg-black/40 border-white/30 text-white mt-1"
            placeholder="Repeat the new password"
          />
        </div>
        {formError && (
          <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p>
        )}
        <Button
          type="submit"
          disabled={status === "submitting"}
          className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg mt-6"
        >
          {status === "submitting" ? "Saving..." : "Reset password"}
        </Button>
        <p className="text-white/50 text-xs text-center">You&apos;ll be signed out on all devices.</p>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
              <ResetPasswordContent />
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
