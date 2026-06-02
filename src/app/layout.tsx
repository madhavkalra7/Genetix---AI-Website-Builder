import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextAuthProvider } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Genetix | AI Website Builder & Code Generator",
  description:
    "Genetix turns natural-language ideas into production-ready websites with real images, responsive design, and deployable source code across multiple frameworks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Genetix",
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        description:
          "AI website builder that generates production-ready, deployable source code from natural-language prompts.",
      },
      {
        "@type": "WebSite",
        name: "Genetix",
        url: siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?prompt={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextAuthProvider>
          <AuthProvider>
            <TRPCReactProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <Toaster />
                {children}
              </ThemeProvider>
            </TRPCReactProvider>
          </AuthProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
