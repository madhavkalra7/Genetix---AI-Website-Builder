"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset link");
      }
      setSentMessage(data.message || "If an account exists for this email, we sent a link to reset your password.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

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
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold font-[Orbitron] mb-2 bg-gradient-to-r from-white via-purple-300 to-blue-300 bg-clip-text text-transparent">
                Forgot Password
              </h1>
              <p className="text-white/60 font-[Orbitron] text-sm">
                We&apos;ll email you a link to choose a new one
              </p>
            </div>

            {sentMessage ? (
              <div className="space-y-6 text-center">
                <div className="text-5xl">📬</div>
                <p className="text-white/80 text-sm">{sentMessage}</p>
                <p className="text-white/50 text-xs">Don&apos;t see it? Check your spam folder.</p>
                <Button asChild className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg">
                  <Link href="/auth/signin">Back to Sign In</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-white/80 font-[Orbitron]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-black/40 border-white/30 text-white mt-1"
                    placeholder="your@email.com"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black hover:bg-gray-200 font-[Orbitron] font-bold py-6 text-lg mt-6"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-white/60 text-sm font-[Orbitron]">
                Remembered it?{" "}
                <Link href="/auth/signin" className="text-white hover:text-purple-300 underline">
                  Sign In
                </Link>
              </p>
            </div>
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
