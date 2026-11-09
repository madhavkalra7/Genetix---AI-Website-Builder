import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Weekly Build Challenges | Genetix",
    description:
        "A new themed build challenge every week. Build it with Genetix, publish, submit your entry and win credits.",
};

export default function ChallengesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
