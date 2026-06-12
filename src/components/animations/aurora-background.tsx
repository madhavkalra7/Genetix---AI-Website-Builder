"use client";
import { useMemo } from "react";

// Deterministic pseudo-random so SSR and client render identical stars
function seeded(i: number, salt: number) {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function Starfield({ count = 70 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: seeded(i, 1) * 100,
        top: seeded(i, 2) * 100,
        size: seeded(i, 3) * 2 + 1,
        delay: seeded(i, 4) * 4,
        duration: 2 + seeded(i, 5) * 3,
      })),
    [count]
  );
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// Layered aurora gradients — pure CSS animation, GPU-cheap
export function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute left-1/2 top-1/3 w-[1000px] h-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-purple-700/40 via-violet-600/25 to-pink-500/30 blur-3xl animate-aurora-1" />
      <div className="absolute left-1/4 top-2/3 w-[700px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-700/25 via-indigo-600/20 to-fuchsia-500/20 blur-3xl animate-aurora-2" />
      <div className="absolute right-0 top-1/4 w-[600px] h-[600px] translate-x-1/3 rounded-full bg-gradient-to-bl from-pink-600/20 via-purple-600/15 to-transparent blur-3xl animate-aurora-3" />
    </div>
  );
}
