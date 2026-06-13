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
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "motion/react"

const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'th', name: 'ไทย', flag: '🇹🇭' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
];

export const Navbar =()=>{
    const isScrolled=useScroll();
    const { user: customAuthUser } = useAuth();
    const { data: session } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
    const { language, setLanguage, t } = useLanguage();
    
    // Check both custom auth and NextAuth
    const user = customAuthUser || session?.user;
    
    const selectedLanguage = languages.find(l => l.code === language) || languages[0];
    
    const handleLanguageChange = (lang: typeof languages[0]) => {
        setLanguage(lang.code as any);
        setLanguageMenuOpen(false);
    };
    
    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
            className={cn(
            "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
            isScrolled && "backdrop-blur-xl bg-black/60 border-b border-white/10 shadow-lg shadow-purple-900/10"
            )}>
            <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 z-10 group">
                    <motion.div whileHover={{ scale: 1.2, rotate: 5 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                        <Image src="/logo.png" alt="genetix" width={24} height={24} className="transition-transform duration-300 group-hover:drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                    </motion.div>
                    <span className="font-semibold text-md text-white">Genetix</span>
                </Link>

                {/* Desktop Prompt Generator */}
                <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
                    <Link
                        href="/prompt-generator"
                        className="text-sm font-[Orbitron] font-semibold text-white px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 hover:border-purple-400/50 transition-all duration-300 hover:shadow-[0_0_16px_rgba(168,85,247,0.3)]"
                    >
                        {t('nav.promptGenerator')}
                    </Link>
                </div>
                
                {/* Desktop Auth Buttons + Language Selector */}
                <div className="hidden md:flex items-center gap-3">
                    {/* Language Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all backdrop-blur-sm"
                            aria-label="Select language"
                        >
                            <span className="text-lg">🌍</span>
                        </button>
                        
                        {languageMenuOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setLanguageMenuOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl overflow-hidden z-50 max-h-96 overflow-y-auto">
                                    <div className="p-2 border-b border-white/10">
                                        <p className="text-xs text-white/60 font-semibold px-2">{t('templates.selectLanguage')}</p>
                                    </div>
                                    {languages.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => handleLanguageChange(lang)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors",
                                                selectedLanguage.code === lang.code && "bg-white/20"
                                            )}
                                        >
                                            <span className="text-xl">{lang.flag}</span>
                                            <span className="text-sm text-white font-medium">{lang.name}</span>
                                            {selectedLanguage.code === lang.code && (
                                                <span className="ml-auto text-green-400">✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    
                    {!user ? (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/auth/signup">{t('nav.signUp')}</Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href="/auth/signin">{t('nav.signIn')}</Link>
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
                    {/* Mobile Language Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 transition-colors text-white"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🌍</span>
                                <span className="text-sm font-semibold">{selectedLanguage.name}</span>
                            </div>
                            <svg className={cn("w-4 h-4 transition-transform", languageMenuOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        
                        {languageMenuOpen && (
                            <div className="mt-2 w-full bg-black/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            handleLanguageChange(lang);
                                            setLanguageMenuOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors",
                                            selectedLanguage.code === lang.code && "bg-white/20"
                                        )}
                                    >
                                        <span className="text-xl">{lang.flag}</span>
                                        <span className="text-sm text-white font-medium">{lang.name}</span>
                                        {selectedLanguage.code === lang.code && (
                                            <span className="ml-auto text-green-400">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
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
        </motion.nav>
    )
}