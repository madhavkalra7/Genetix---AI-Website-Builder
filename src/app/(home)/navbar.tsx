"use client"
import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import { SignedIn , SignedOut, SignInButton,SignUpButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { UserControl } from "@/components/user-control"
import { useScroll } from "@/hooks/use-scroll"
import { is } from "date-fns/locale"

export const Navbar =()=>{
    const isScrolled=useScroll();
    return (
        <nav className={cn(
            "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent",
            isScrolled && "backdrop-blur bg-black/50 border-b border-white/10"
            )}>
            <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.png" alt="genetix" width={24} height={24} />
                    <span className="font-semibold text-md text-white">Genetix</span>
                </Link>
                <div className="absolute left-1/2 transform -translate-x-1/2">
                    <Link
                        href="/prompt-generator"
                        className="text-sm font-[Orbitron] font-semibold text-white px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                    >
                        Prompt Generator
                    </Link>
                </div>
                <SignedOut>
                    <div className="flex gap-2">
                        <SignUpButton>
                            <Button variant="outline" size="sm">
                                Sign Up
                            </Button>
                        </SignUpButton>
                        <SignInButton>
                            <Button size="sm">
                                Sign In
                            </Button>
                        </SignInButton>
                    </div>
                </SignedOut>
                <SignedIn>
                    <UserControl showName />
                </SignedIn>
            </div>
        </nav>
    )
}