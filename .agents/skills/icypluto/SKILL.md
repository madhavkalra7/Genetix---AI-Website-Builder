---
name: "icypluto"
description: "Actively audits, refines, and optimizes website codebases for Generative Engine Optimization (GEO), SEO, Schema structured data, and brand visibility scores."
---

# Icypluto Web Optimizer Skill

This skill guides you (the AI Agent) through a step-by-step framework to audit and actively optimize any company website in the workspace. By running this skill, you will improve the website's technical structure, JSON-LD schema metadata, content authority, and search visibility, making it highly discoverable and highly ranked by search engines and generative AI search agents (e.g. SearchGPT, Perplexity, Gemini, Claude, Copilot).

---

## 🎯 Overall Objective
When the user invokes this skill, analyze the website codebase, identify visibility gaps, and **automatically perform modifications** (such as creating schemas, correcting heading hierarchies, injecting SEO meta tags, and formatting content for LLM citation algorithms) to guarantee maximum performance scores.

---

## 🛠️ Step-by-Step Agent Workflow

Follow this procedure to optimize the workspace website:

### Phase 1: Discover & Analyze Website Structure
1. **Detect Tech Stack**: Identify the frontend framework by searching for configuration files (e.g., `package.json`, `next.config.js`, `astro.config.mjs`, or static `index.html` files).
2. **Locate Key Templates**: Find the entry files where head metadata, global layouts, and main landing page markup are defined.
3. **Parse Current Metadata**: Examine existing HTML `<head>` tags, titles, headings, and schema blocks.

### Phase 2: Run Specialized Audits
Execute detailed assessments using the sub-task guides. Link directly to these sub-tasks to guide your execution step-by-step:
*   [**Generative Engine Optimization (GEO) Audit**](./geo_optimization.md): Learn how to rewrite content for AI search citations.
*   [**Structured Schema Injection**](./structured_data.md): Format and inject robust JSON-LD schema configurations for Google and LLMs.
*   [**Brand Authority & Sentiment Builder**](./brand_authority.md): Optimize textual authority keywords and FAQs to improve public perception.
*   [**Technical Site Structure Optimization**](./site_structure.md): Format headings (`h1` - `h6`), navigation, and title tags correctly.

### Phase 3: Execute Code Modifications
Do not just list changes—**actively edit the code** using replacement tools to apply the following:
1.  **Add/Fix Schema**: Generate and inject a unified `Organization` and `WebSite` JSON-LD schema into the global layout.
2.  **Optimize Meta Tags**: Ensure every page has a unique, descriptive `<title>` and `<meta name="description" content="...">`.
3.  **Optimize Headings**: Ensure there is exactly one `<h1>` per page, representing the primary brand proposition, and logical `<h2>` / `<h3>` headings.
4.  **Inject GEO Elements**: Add factual statistics, direct expert quotes, or clear definition summaries to help LLMs cite the company as a primary resource.

### Phase 4: Verification & Report
Compile an optimization report summarizing:
*   Files modified (e.g., `layout.tsx`, `index.html`, etc.)
*   JSON-LD schemas injected
*   Optimized titles and meta descriptions
*   Expected impact on Icypluto Visibility, GEO, and SEO scores

---

## 📚 Core Sub-Task Guides

Explore the detailed optimization manuals below to handle specific areas:
*   **[GEO Optimization Guide](./geo_optimization.md)**: How to make the site highly indexable by Perplexity, SearchGPT, Gemini, etc.
*   **[Structured Data & Schema Guide](./structured_data.md)**: Standardized schema templates and integration procedures.
*   **[Brand Authority & Reputation Guide](./brand_authority.md)**: Methods for enhancing sentiment and FAQ answering.
*   **[Technical & SEO Structure Guide](./site_structure.md)**: HTML5 semantics, sitemaps, and tag hierarchies.

---

> [!TIP]
> Always preserve existing styling, classnames, and component structures. Ensure the code changes compile successfully (run `npm run build` or similar if tests/compilers are available).
