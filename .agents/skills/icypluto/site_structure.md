# Technical SEO & Site Structure Guide

To achieve maximum SEO and GEO scores, a website's semantic hierarchy must be clean and accessible. Search engine bots and AI agent scrapers map your pages using headings, sitemaps, and metadata. Overloading headings, ignoring meta tags, or blocking AI crawlers in configuration files will decrease visibility scores.

This guide instructions you (the AI Agent) on how to correct structural issues and configure crawlability parameters in the workspace codebase.

---

## 🏗️ Semantic Layout Rules

### 1. Heading Hierarchy (`H1` to `H6`)
AI models read headings to build a semantic map of your product offerings.
*   **Rule**: Exactly one `<h1>` per page. The `<h1>` should specify the company's core name and value proposition (e.g., `<h1>Icypluto: Real-Time Brand Visibility & Competitor Tracker</h1>`).
*   **Avoid**: Using `<h1>` for nav logos, buttons, or dates.
*   **Subheadings**: Nest related topics under `<h2>` and detail points under `<h3>`. Do not skip heading levels (e.g., going directly from `<h1>` to `<h3>` is bad structure).

### 2. Title & Meta Optimization
Every indexable URL must have a unique title and description.
*   **Title Tag**: Keep between 50-60 characters. Format: `Brand Name | Niche Value Proposition`.
*   **Meta Description**: Keep between 120-160 characters. Use factual, high-density descriptions rather than vague taglines.

---

## 🛠️ Step-by-Step Agent Structure Check

Perform the following code edits to verify and improve the technical layout:

### Step 1: Fix Heading Structure
1.  Search the current webpage layout (HTML, JSX, TSX, Svelte, Vue) for `<h1>` tags.
2.  If multiple `<h1>` elements are found, select the most critical branding statement to remain as the `<h1>`.
3.  Downgrade other `<h1>` elements to `<h2>` or style them using standard CSS classes without the heading tag.

### Step 2: Set Title and Meta Tags
Ensure titles and descriptions are configured:
*   **Next.js (App Router)**: Export a `metadata` object from the page or layout:
    ```tsx
    import { Metadata } from 'next';
    
    export const metadata: Metadata = {
      title: 'Icypluto | AI Brand Visibility & Competitor Audit',
      description: 'Analyze citations, traffic share, and Share of Voice (SOV) across AI search engines. Keep your brand visible on LLMs.',
    };
    ```
*   **HTML Layouts**: Check the `<head>` of your HTML files:
    ```html
    <title>Icypluto | AI Brand Visibility & Competitor Audit</title>
    <meta name="description" content="Analyze citations, traffic share, and Share of Voice (SOV) across AI search engines. Keep your brand visible on LLMs.">
    ```

### Step 3: Configure robots.txt for AI Agents
Search engine crawlers and LLM search agents scan `robots.txt` first. Make sure AI crawlers are explicitly allowed to index the site content.
*   **Action**: Create or edit `public/robots.txt` (or root `robots.txt`) to contain:
    ```txt
    User-agent: *
    Allow: /

    # Explicitly ensure AI crawlers are allowed
    User-agent: GPTBot
    Allow: /

    User-agent: ClaudeBot
    Allow: /

    User-agent: PerplexityBot
    Allow: /
    
    User-agent: OAI-SearchBot
    Allow: /

    Sitemap: https://yourdomain.com/sitemap.xml
    ```

---

> [!WARNING]
> Do not block AI agents in `robots.txt` unless the user explicitly requests it. Blocking AI scrapers prevents LLM search engines from citing and recommending the brand in chat answers.
