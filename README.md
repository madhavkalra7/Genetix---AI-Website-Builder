# Genetix: AI Website Builder

Describe a website in plain English, and Genetix writes the code, runs it in a cloud sandbox, and shows you a live preview you can keep refining by chatting.

**Live demo:** https://genetix-ai-website-builder.vercel.app

https://github.com/user-attachments/assets/83e8384d-63ef-40fe-b9e8-299f4d8ea06d

## Features

- **Prompt to website.** An AI agent plans, writes, and fixes the code for you.
- **Live preview.** Every generated project runs in an isolated [E2B](https://e2b.dev) sandbox.
- **Chat to iterate.** Ask for changes and the agent edits the existing code.
- **Multiple stacks.** React/Next.js, Vue/Nuxt, Angular, SvelteKit, or plain HTML/CSS/JS.
- **50+ starter templates.** Pick one as a starting point (SaaS, portfolio, restaurant, e-commerce, and more).
- **Mobile app mode.** Generate mobile app prototypes with a live preview.
- **Prompt generator.** Turns a rough idea into a detailed build prompt.
- **Accounts and credits.** Email, Google, and GitHub sign-in, usage credits, and an admin panel.

## Tech stack

| Area | Tools |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| API | tRPC, TanStack Query |
| Database | PostgreSQL with Prisma |
| AI agent | Inngest Agent Kit and OpenAI |
| Code execution | E2B sandboxes |
| Auth | NextAuth (credentials, Google, GitHub) |

## How it works

1. You send a prompt. The app saves it and fires an Inngest event.
2. The Inngest function ([src/inngest/functions.ts](src/inngest/functions.ts)) starts an E2B sandbox and runs a coding agent. The agent has tools to run terminal commands and to create and read files.
3. When the agent finishes, the generated files and the sandbox preview URL are saved as a "fragment", and the UI shows the live preview.

## Self-hosting

### Prerequisites

- Node.js 20 or newer
- A PostgreSQL database (local, [Neon](https://neon.tech), or [Supabase](https://supabase.com))
- An [OpenAI API key](https://platform.openai.com/api-keys)
- An [E2B API key](https://e2b.dev/dashboard)

### 1. Install

```bash
git clone https://github.com/madhavkalra7/Genetix---AI-Website-Builder.git
cd Genetix---AI-Website-Builder
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in at least `DATABASE_URL`, `OPENAI_API_KEY`, `E2B_API_KEY`, `E2B_TEMPLATE_ID`, and `NEXTAUTH_SECRET`. Everything else is optional. Each variable is explained in [.env.example](.env.example).

### 3. Build the E2B sandbox template

Generated apps run inside a custom sandbox image defined in [sandbox-templates/nextjs](sandbox-templates/nextjs).

```bash
npm install -g @e2b/cli
e2b auth login
cd sandbox-templates/nextjs
e2b template build
```

Copy the template ID it prints into `E2B_TEMPLATE_ID` in your `.env`.

### 4. Set up the database

```bash
npx prisma migrate deploy
npx prisma db seed   # creates the default billing plans
```

### 5. Run it

You need two terminals:

```bash
# Terminal 1: the app
npm run dev

# Terminal 2: the Inngest dev server (runs the AI agent jobs)
npx inngest-cli@latest dev
```

Open http://localhost:3000. The Inngest dashboard is at http://localhost:8288.

## Project structure

```
src/
  app/          Next.js routes (pages and API routes)
  components/   Shared UI components
  inngest/      Background jobs: the AI coding agent
  modules/      Feature modules (projects, messages, usage, subscription, admin)
  trpc/         tRPC setup
  prompt.ts     System prompts for the agent
prisma/         Database schema, migrations, and seed
public/templates/  Starter website templates
sandbox-templates/ E2B sandbox image
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started, and look for issues labelled [`good first issue`](https://github.com/madhavkalra7/Genetix---AI-Website-Builder/labels/good%20first%20issue).

## License

[MIT](LICENSE) © Madhav Kalra
