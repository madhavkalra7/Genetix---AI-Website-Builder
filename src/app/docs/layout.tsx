import { Metadata } from "next";
import { Navbar } from "@/app/(home)/navbar";

export const metadata: Metadata = {
    title: "Documentation | Genetix",
    description: "Official documentation for Genetix AI Website Builder. Learn how to generate, export, and deploy AI-created websites.",
};

import { LanguageProvider } from "@/contexts/LanguageContext";

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LanguageProvider>
            <div className="flex flex-col min-h-screen bg-black overflow-x-hidden">
                <Navbar />
                <div className="flex-1 mt-16 md:mt-20">
                    {children}
                </div>
            </div>
        </LanguageProvider>
    );
}