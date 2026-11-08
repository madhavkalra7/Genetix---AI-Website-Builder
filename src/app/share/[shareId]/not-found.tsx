import Image from "next/image";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShareNotFound() {
    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
            <header className="flex items-center px-4 py-3 border-b border-white/10">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.png" alt="Genetix" width={24} height={24} />
                    <span className="font-semibold">Genetix</span>
                </Link>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-full bg-white/5 border border-white/10 p-4">
                    <LinkIcon className="size-8 text-purple-400" />
                </div>
                <h1 className="text-2xl font-bold font-[Orbitron]">This link isn&apos;t available</h1>
                <p className="text-sm text-white/60 max-w-sm">
                    The project doesn&apos;t exist, or its owner turned off sharing. Why not build something of your own?
                </p>
                <Button asChild variant="venom" className="h-auto px-6 py-2.5 font-[Orbitron]">
                    <Link href="/">Build your own</Link>
                </Button>
            </main>
        </div>
    );
}
