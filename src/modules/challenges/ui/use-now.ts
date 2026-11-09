"use client";

import { useEffect, useState } from "react";

/** Current time, re-rendered every `intervalMs` (client-side ticking for countdowns). */
export function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
    return now;
}
