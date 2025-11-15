"use client"
import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { UserControl } from "@/components/user-control"
import { useScroll } from "@/hooks/use-scroll"
import { useAuth } from "@/contexts/AuthContext"
import { useSession } from "next-auth/react"
import { useState } from "react"

export const Navbar =()=>{
    const isScrolled=useScroll();
    const { user: customAuthUser } = useAuth();
    const { data: session } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // Check both custom auth and NextAuth
    const user = customAuthUser || session?.user;
    
    return (
        <nav className={cn(
            "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent",
            isScrolled && "backdrop-blur bg-black/50 border-b border-white/10"
            )}>
            <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 z-10">
                    <Image src="/logo.png" alt="genetix" width={24} height={24} />
                    <span className="font-semibold text-md text-white">Genetix</span>
                </Link>
                
                {/* Desktop Prompt Generator */}
                <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
                    <Link
                        href="/prompt-generator"
                        className="text-sm font-[Orbitron] font-semibold text-white px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                    >
                        Prompt Generator
                    </Link>
                </div>
                
                {/* Desktop Auth Buttons */}
                <div className="hidden md:flex items-center">
                    {!user ? (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/auth/signup">Sign Up</Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href="/auth/signin">Sign In</Link>
                            </Button>
                        </div>
                    ) : (
                        <UserControl showName />
                    )}
                </div>
                
                {/* Mobile Menu Button */}
                <button 
                    className="md:hidden text-white z-10"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        {mobileMenuOpen ? (
                            <path d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>
            
            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-lg border-b border-white/10 p-4 space-y-4">
                    <Link
                        href="/prompt-generator"
                        className="block text-sm font-[Orbitron] font-semibold text-white px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 transition-colors text-center"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Prompt Generator
                    </Link>
                    {!user ? (
                        <div className="flex flex-col gap-2">
                            <Button variant="outline" size="sm" asChild className="w-full">
                                <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                            </Button>
                            <Button size="sm" asChild className="w-full">
                                <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <UserControl showName />
                        </div>
                    )}
                </div>
            )}
        </nav>
    )
}