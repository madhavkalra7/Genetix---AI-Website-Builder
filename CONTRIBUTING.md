# Contributing to Genetix

Thanks for wanting to help. Bug fixes, new templates, docs improvements, and features are all welcome.

## Getting set up

Follow the [self-hosting steps in the README](README.md#self-hosting) to run Genetix locally. You'll need your own OpenAI and E2B API keys.

## Making a change

1. Find an issue to work on, or open one describing what you'd like to change. For anything large, please open an issue first so we can agree on the approach.
2. Comment on the issue to say you're working on it.
3. Fork the repo and create a branch: `git checkout -b fix/short-description`.
4. Make your change. Keep each pull request focused on one thing.
5. Check that it builds and lints:
   ```bash
   npm run lint
   npm run build
   ```
6. Open a pull request that links the issue and explains what changed and how you tested it. Screenshots help for UI changes.

## Guidelines

- Use TypeScript and follow the existing code style.
- Never commit secrets. Your `.env` file is ignored by git. If you add a new environment variable, add it to `.env.example` with a short comment.
- If you change the database schema, include the Prisma migration (`npx prisma migrate dev --name your_change`).
- New starter templates go in `public/templates/` and are registered in `src/lib/templates.ts`.

## Reporting bugs

Open an issue using the bug report template. Include steps to reproduce, what you expected, and what happened.

## Security issues

Please don't open a public issue for security problems. Report them privately through [GitHub security advisories](https://github.com/madhavkalra7/Genetix---AI-Website-Builder/security/advisories/new).
