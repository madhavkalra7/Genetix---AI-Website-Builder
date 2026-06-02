import type { Metadata } from "next";
import { Navbar } from "./navbar";
import { LanguageProvider } from "@/contexts/LanguageContext";

interface Props {
    children: React.ReactNode;
};

export const metadata: Metadata = {
    title: "Genetix | Build Websites With AI",
    description:
        "Describe your website in natural language and get a production-ready site with real images, responsive layout, and deployable code across 5 tech stacks.",
};

const Layout = ({ children }: Props) => {
    return (
        <LanguageProvider>
            <main className="flex flex-col min-h-screen bg-black overflow-x-hidden">
                <Navbar />
                <div className="flex-1 flex flex-col">
                    {children}
                </div>
            </main>
        </LanguageProvider>
    );
};

export default Layout;