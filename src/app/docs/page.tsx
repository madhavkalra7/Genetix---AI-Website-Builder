import Link from "next/link";
import { Book, Code, Zap, Layout, MonitorSmartphone, Server, Shield, Sparkles } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8 md:p-12 lg:p-24 selection:bg-purple-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-purple-400">
            <Book className="h-8 w-8" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-['Orbitron']">
              Genetix <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Documentation</span>
            </h1>
          </div>
          <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
            Welcome to the official Genetix documentation. Learn how to transform your natural language ideas into production-ready websites in seconds.
          </p>
        </div>

        {/* Getting Started Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            <h2 className="text-2xl font-semibold">Getting Started</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors">
              <h3 className="text-xl font-medium mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-sm">1</span>
                Describe Your Vision
              </h3>
              <p className="text-white/60 text-sm">
                Navigate to the Prompt Generator and describe the website you want to build in plain English. The more details you provide, the better the result.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors">
              <h3 className="text-xl font-medium mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-sm">2</span>
                Watch AI Build It
              </h3>
              <p className="text-white/60 text-sm">
                Genetix will immediately start generating the layout, selecting relevant real-world images, and writing the code structure.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors md:col-span-2">
              <h3 className="text-xl font-medium mb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-sm">3</span>
                Export & Deploy
              </h3>
              <p className="text-white/60 text-sm">
                Once generated, you can view the source code, preview the site across device sizes, and export the code in your preferred tech stack (Next.js, React, Vue, HTML/JS, etc.).
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Sparkles className="h-6 w-6 text-pink-400" />
            <h2 className="text-2xl font-semibold">Core Features</h2>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 rounded-lg bg-white/5">
              <Layout className="h-6 w-6 text-blue-400 shrink-0 mt-1" />
              <div>
                <h4 className="font-medium text-lg">Intelligent Layout Generation</h4>
                <p className="text-white/60 text-sm mt-1">
                  Our AI analyzes your prompt to structure the page logically, creating hero sections, feature grids, testimonials, and footers automatically.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start p-4 rounded-lg bg-white/5">
              <MonitorSmartphone className="h-6 w-6 text-green-400 shrink-0 mt-1" />
              <div>
                <h4 className="font-medium text-lg">Fully Responsive by Default</h4>
                <p className="text-white/60 text-sm mt-1">
                  Every generated website is mobile-ready out of the box, utilizing modern CSS frameworks like Tailwind CSS to ensure a perfect fit on any screen size.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start p-4 rounded-lg bg-white/5">
              <Code className="h-6 w-6 text-purple-400 shrink-0 mt-1" />
              <div>
                <h4 className="font-medium text-lg">Multiple Tech Stacks</h4>
                <p className="text-white/60 text-sm mt-1">
                  Don't be locked into one framework. Export your generated site to Next.js, React (Vite), Vue, plain HTML/CSS/JS, or Svelte.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Support/Footer */}
        <div className="pt-8 border-t border-white/10 text-center space-y-4">
          <p className="text-white/60">
            Need more help? Explore the <Link href="/templates" className="text-purple-400 hover:text-purple-300 underline underline-offset-4">templates</Link> or contact support.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors border border-white/10">
             Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}