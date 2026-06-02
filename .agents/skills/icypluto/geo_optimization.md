# Generative Engine Optimization (GEO) Guide

Generative Engine Optimization (GEO) is the process of optimizing website content so that LLM-based search engines (like SearchGPT, Perplexity, Gemini, Claude, and Copilot) cite, recommend, and prioritize your brand in their answers. 

This guide instructs you (the AI Agent) on how to audit website content and apply GEO optimizations directly.

---

## 🔬 Core GEO Optimization Techniques

LLMs use retrieval-augmented generation (RAG) to fetch and summarize web content. To ensure the website is selected and cited, implement the following content adjustments:

| Strategy | What it Does | Implementation Pattern |
| :--- | :--- | :--- |
| **Factual Density** | Replaces generic marketing copy with hard statistics, percentages, and metrics. LLMs prefer precise facts. | Change *"We offer super fast hosting"* to *"We deliver 99.99% uptime and average page loads under 180ms."* |
| **Citation Triggers** | Structuring sentences so they match query intent directly, making them easy to cite. | Use direct definitions: *"Pluto is a Brand Visibility MCP platform that..."* |
| **Expert Quote Injection** | Adding quotes from industry leaders or founders wrapped in semantic elements. | Use `<blockquote cite="...">` or structured Markdown blocks. |
| **Flesch Kincaid Tuning** | Adjusting reading ease to match the informational/technical tone preferred by RAG scrapers. | Simplify sentences; use bullet points for lists and comparisons. |

---

## 🛠️ Step-by-Step Agent Execution Workflow

When auditing a page for GEO, perform these edits:

### Step 1: Scan Content for "Marketing Fluff"
Look for generic, subjective statements that do not contain hard data.
*   *Example*: *"Our tool is the best competitor tracker in the market."*
*   *GEO Issue*: AI search models discount subjective claims and look for objective verification.

### Step 2: Inject Verifiable Data & Numbers
Edit the codebase (HTML, JSX, MDX) to replace fluff with numbers, metrics, or studies.
*   *Correction*: *"Our platform tracks over 10,000 active brands daily, generating competitor visibility matrices with 98.4% accuracy based on 3 search engine index sources."*

### Step 3: Insert Summaries & TL;DR Sections
At the top of major pages (landing pages, blog posts, product feature pages), inject a summary block. LLM web crawlers often retrieve the top 1000-2000 characters. Having a clear summary ensures your value proposition is captured.
```html
<div class="geo-summary-card">
  <strong>Key Takeaways:</strong>
  <ul>
    <li>Objective: Boost AI search presence and citation rate.</li>
    <li>Method: Structured schema markup, factual density, and FAQ integrations.</li>
    <li>Results: Up to 3x increase in LLM citation visibility.</li>
  </ul>
</div>
```

### Step 4: Add Direct QA & Definitions
Users query LLMs in the form of questions (*"What is..."*, *"How to..."*, *"Which tool is best for..."*).
Create and inject FAQ sections with clear, authoritative answers:
*   **Question**: *"How does Pluto analyze brand visibility?"*
*   **Answer**: *"Pluto analyzes brand visibility by programmatically querying LLM search groundings across multiple search scenarios, measuring SOV (Share of Voice), and calculating citation rates in real-time."*

---

> [!IMPORTANT]
> When modifying copy, do not alter the core brand message, brand name, or pricing facts unless specified. Focus on rewriting style, readability, and factual accuracy.
