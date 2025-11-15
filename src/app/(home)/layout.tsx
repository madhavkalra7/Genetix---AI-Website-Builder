import {Navbar} from "./navbar";
import { LanguageProvider } from "@/contexts/LanguageContext";

interface Props {
    children: React.ReactNode;
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