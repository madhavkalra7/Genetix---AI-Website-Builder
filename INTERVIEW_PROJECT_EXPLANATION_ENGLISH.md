# 🎤 Genetix — AI Website Builder | Interview Explanation (2 Min Script)

---

## 🗣️ 2-Minute Speaking Script (English)

> **"My project is called Genetix — an AI-powered Website Builder. The idea is simple — the user just describes their website in natural language, for example 'Build me a restaurant website with menu and reservation' — and Genetix generates the entire website within seconds, complete with real images, responsive design, and deployable source code."**

> **"I built this project on Next.js 15 with React 19, TypeScript, Tailwind CSS, and PostgreSQL with Prisma ORM. On the backend, I used tRPC which provides type-safe API calls — meaning the frontend and backend types stay perfectly in sync, eliminating any type mismatches at compile time."**

> **"For the core AI logic, I used Inngest Agent Kit which enables a multi-agent architecture. There's a coding agent powered by OpenAI's GPT-5.1 and GPT-5-mini models — it takes the user's prompt, generates code, and executes it inside an E2B Cloud Sandbox. This sandbox is a real isolated Linux environment where the code actually runs — files are created, dependencies are installed, and a live preview is served."**

> **"The project supports 5 tech stacks — React/Next.js, HTML/CSS/JS, Vue/Nuxt, Angular, and SvelteKit. It also includes 50+ pre-built templates like SaaS landing pages, e-commerce stores, portfolios, restaurants, and more. I integrated the Unsplash and Pexels APIs which automatically fetch relevant stock images and inject them into the generated website."**

> **"For authentication, I built a custom session-based auth system with bcrypt password hashing, email verification, OAuth support for Google and GitHub via NextAuth, and middleware-based route protection. For billing, I integrated both Stripe and Razorpay with subscription plans, a credits system, and rate limiting."**

> **"The key challenges I solved include multi-agent memory management — persisting conversation history across sessions so the AI remembers previous code, cross-tech-stack sandbox execution, real-time image injection, and credits-based usage tracking with rate limiting. These are all production-grade features."**

---

## 📋 Quick Reference — Project Overview

| Aspect | Details |
|--------|---------|
| **Project Name** | Genetix — AI Website Builder |
| **What it does** | User describes a website in natural language → AI generates full code + live preview |
| **Type** | Full-Stack SaaS Application |
| **Live Demo** | Working with sandbox deployment |

---

## 🏗️ Architecture & Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 15** (App Router + Turbopack) | React framework for SSR, routing, API routes |
| **React 19** | UI library with latest concurrent features |
| **TypeScript** | Type safety across entire codebase |
| **Tailwind CSS 4** | Utility-first styling |
| **Radix UI** | Accessible headless UI components (Dialog, Select, Tabs, etc.) |
| **Shadcn/UI** | Pre-built component library on top of Radix |
| **TanStack React Query** | Server state management & caching |
| **React Hook Form + Zod** | Form handling with schema validation |
| **Sonner** | Toast notifications |
| **Recharts** | Data visualization for usage stats |

### Backend
| Technology | Purpose |
|-----------|---------|
| **tRPC** | End-to-end type-safe API (no REST, no GraphQL) |
| **Prisma ORM** | Database access layer with migrations |
| **PostgreSQL** | Primary relational database |
| **Inngest** | Background job processing & agent orchestration |
| **NextAuth.js** | OAuth authentication (Google, GitHub) |
| **Custom Auth** | Session-based auth with bcrypt, email verification |
| **Rate Limiter Flexible** | API rate limiting per user |

### AI & Sandboxing
| Technology | Purpose |
|-----------|---------|
| **OpenAI GPT-5.1 / GPT-5-mini** | Code generation AI models |
| **Inngest Agent Kit** | Multi-agent system framework |
| **E2B Cloud Sandbox** | Isolated code execution environment |
| **Unsplash + Pexels API** | Auto-fetch relevant stock images |

### Payments
| Technology | Purpose |
|-----------|---------|
| **Stripe** | International payments & subscriptions |
| **Razorpay** | Indian payment gateway |
| **Cashfree** | Additional payment option |

---

## 🧠 Core Architecture — How It Works

```
User Prompt ("Build a restaurant website")
        ↓
   Next.js Frontend (React 19 + TypeScript)
        ↓
   tRPC API Call (type-safe)
        ↓
   Inngest Event Triggered ("code-agent/run")
        ↓
   Multi-Agent Network (Inngest Agent Kit)
        ↓
   ┌─────────────────────────────────┐
   │  Code Agent (GPT-5.1/5-mini)   │
   │  - Reads existing files         │
   │  - Generates new code           │
   │  - Uses tools:                  │
   │    • terminal (run commands)    │
   │    • createOrUpdateFiles        │
   │    • readFiles                  │
   └─────────────────────────────────┘
        ↓
   E2B Cloud Sandbox
   (Real execution: npm install, file creation, live server)
        ↓
   Images fetched from Unsplash/Pexels → injected as base64
        ↓
   Fragment saved to DB (files JSON + sandbox URL)
        ↓
   Live Preview shown to user in iframe
```

---

## 🔐 Authentication System

```
┌──────────────────────────────────────┐
│         Dual Auth Strategy           │
├──────────────────────────────────────┤
│                                      │
│  1. Custom Auth (Email/Password)     │
│     • bcrypt password hashing        │
│     • UUID session tokens            │
│     • Email verification (OTP)       │
│     • Password reset flow            │
│                                      │
│  2. OAuth (via NextAuth.js)          │
│     • Google Sign-In                 │
│     • GitHub Sign-In                 │
│     • Auto-links with custom auth    │
│                                      │
│  3. Middleware Protection             │
│     • Public routes (/, /pricing)    │
│     • Protected routes (/projects)   │
│     • Session cookie validation      │
│                                      │
└──────────────────────────────────────┘
```

---

## 💰 Billing & Credits System

- **Free Tier**: 3 website generations per month
- **Paid Plans**: Monthly/Yearly subscriptions via Stripe/Razorpay
- **Credits System**: `UserCredits` model tracks usage per user
- **Advanced Reasoning**: GPT-5.1 access with a 24-hour cooldown limit
- **Rate Limiting**: Per-user request throttling

---

## 📊 Database Schema (Key Models)

| Model | Purpose |
|-------|---------|
| `User` | User profile, email, password hash, OAuth links |
| `Account` | OAuth provider accounts (Google, GitHub) |
| `Session` | Active login sessions with token + expiry |
| `Project` | User's website projects with tech stack choice |
| `Message` | Chat messages (USER/ASSISTANT) per project |
| `Fragment` | Generated code files + sandbox URL per message |
| `Subscription` | Active plan subscription per user |
| `Plan` | Available pricing plans with features |
| `Payment` | Payment transaction records |
| `UserCredits` | Usage tracking (credits used/limit) |
| `AdvancedReasoningUsage` | GPT-5.1 24hr cooldown tracking |

---

## 🌟 Key Features to Highlight

1. **Multi-Tech Stack Support** — React, Vue, Angular, Svelte, HTML/CSS/JS
2. **50+ Pre-built Templates** — SaaS, E-commerce, Portfolio, Restaurant, Gaming, etc.
3. **Real Code Execution** — E2B Sandbox runs actual code, not just previews
4. **Auto Image Injection** — Unsplash/Pexels images auto-fetched by keywords
5. **Conversation Memory** — Agent remembers full chat history for iterative builds
6. **Voice Input** — Speech-to-text for describing websites
7. **Live Preview** — Iframe-based real-time website preview
8. **Code Editor** — Built-in file explorer + syntax-highlighted code view
9. **Multi-Language UI** — Internationalization support (LanguageContext)
10. **Production Billing** — Stripe + Razorpay with credits & subscriptions

---

## ❓ Common Interview Questions & Answers

### Q1: "Why did you choose tRPC over REST or GraphQL?"
> tRPC gives end-to-end type safety between frontend and backend. Since both are in TypeScript, I get auto-complete and compile-time error checking on API calls. No schema definitions needed like GraphQL, and no type mismatches like REST.

### Q2: "How does the AI generate websites?"
> I use a multi-agent architecture with Inngest Agent Kit. The user's prompt goes to a Code Agent backed by GPT-5.1/5-mini. The agent has 3 tools — terminal, createOrUpdateFiles, readFiles. It plans the website, writes code, installs dependencies, and runs everything inside an E2B cloud sandbox. The sandbox is a real Linux container where code actually executes.

### Q3: "How do you handle authentication?"
> I built a dual auth system — custom email/password auth with bcrypt hashing and session tokens stored in PostgreSQL, plus OAuth via NextAuth.js for Google and GitHub. Middleware protects routes by checking session cookies. Both auth methods share the same User model.

### Q4: "What was the biggest challenge?"
> Agent memory management. Initially, the AI would forget previous code when users asked for modifications. I solved it by persisting all conversation history and code fragments in the database, pre-loading existing files into the sandbox before each agent run, and providing file context in the prompt.

### Q5: "How is this different from Wix or Squarespace?"
> Those are drag-and-drop builders. Genetix generates actual source code — React, Vue, Angular, etc. — that users own and can deploy anywhere. Plus it supports 5 different tech stacks, uses AI to understand natural language requirements, and provides full code editor access.

### Q6: "How do you handle payments?"
> Stripe for international users, Razorpay for Indian users. I have a subscription model with plans stored in the database, webhook handlers for payment confirmations, and a credits system that tracks per-user usage with monthly resets.

### Q7: "What about scalability?"
> Next.js with Turbopack for fast builds, Inngest for async background processing (AI generation doesn't block the server), Prisma with connection pooling for the database, rate limiting per user, and E2B sandboxes are ephemeral — they spin up per request and auto-destroy.

### Q8: "What did you learn from this project?"
> Multi-agent AI systems architecture, production-grade payment integration, building type-safe full-stack apps with tRPC, managing cloud sandboxes, and implementing proper auth with both custom and OAuth flows. I also learned a lot about prompt engineering for code generation.

---

## 🎯 One-Liner Elevator Pitch

> **"Genetix is an AI-powered SaaS platform where users describe a website in natural language and get production-ready, deployable code generated in real-time across 5 tech stacks — built with Next.js 15, OpenAI, and cloud sandboxing."**

---

## 📁 Project Structure (Simplified)

```
src/
├── app/                    # Next.js App Router pages
│   ├── (home)/             # Landing page, pricing, templates
│   ├── api/                # API routes (auth, payments, webhooks)
│   ├── auth/               # Sign-in, Sign-up pages
│   ├── project/[id]/       # Individual project workspace
│   └── projects/           # User's project dashboard
├── components/             # Reusable UI components
├── contexts/               # React contexts (Auth, Language)
├── inngest/                # AI agent functions & orchestration
├── lib/                    # Utilities (auth, DB, images, templates)
├── modules/                # Feature modules (messages, projects, etc.)
├── trpc/                   # tRPC router & procedures
├── middleware.ts            # Route protection middleware
├── prompt.ts                # AI prompts for all 5 tech stacks
└── types.ts                 # Shared TypeScript types

prisma/
├── schema.prisma           # Database schema (11 models)
├── seed.ts                 # Database seeding script
└── migrations/             # Version-controlled DB migrations

public/templates/           # 50+ pre-built HTML templates
sandbox-templates/          # E2B sandbox templates
```

---

*Good luck with your placement interviews! 🚀*
