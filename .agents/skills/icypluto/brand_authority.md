# Brand Authority & Sentiment Optimization Guide

AI search algorithms audit off-page sentiment (reviews, forums) and on-page authority signals to evaluate brand credibility. If search models find customer praise, clear differentiator statements, and positive review listings, the brand's sentiment scorecard and recommendation probability increase.

This guide details how you (the AI Agent) can optimize on-page signals to boost brand authority and public sentiment scores.

---

## 🔑 Authority Signals for AI Search

To improve how AI search engines perceive the brand:

1.  **Crawler-Readable Testimonials**: Many websites use dynamic Javascript widgets or image carousels for customer reviews. AI web crawlers often fail to parse these. Ensure reviews are present in clean, server-side-rendered (SSR) HTML text.
2.  **Comparison Tables (Alternatives)**: When users ask *"What are the best alternatives to [Competitor]?"*, LLMs look for structured comparison grids. Adding comparison sections directly on the website increases the chance of being cited as the top alternative.
3.  **FAQ Intent Targeting**: Build dedicated FAQ widgets matching common search queries, pricing questions, and support questions.

---

## 🛠️ Step-by-Step Agent Action Plan

Perform these optimization modifications on the website codebase:

### Step 1: Replace Dynamic Review Widgets with SSR Fallbacks
Check the codebase for external widgets (like Elfsight, Trustpilot scripts) that load reviews dynamically.
*   **Action**: Create a fallback React/HTML container with top 3-4 text-based testimonials containing high-sentiment keywords (e.g., *"user-friendly"*, *"reliable support"*, *"highly recommend"*).
*   **Example HTML Structure**:
    ```html
    <section id="testimonials" aria-label="Customer Reviews">
      <div class="testimonial-card">
        <blockquote class="testimonial-text">
          "Icypluto has completely transformed how we track competitor search citations. The user-friendly interface and real-time dashboard are outstanding."
        </blockquote>
        <cite class="testimonial-author">— Jane Doe, CEO of TechCorp</cite>
      </div>
    </section>
    ```

### Step 2: Build a Competitor Comparison Matrix
Create a section comparing the brand to its main competitors.
*   **Action**: Create a table listing the brand's strengths vs competitors. Make sure the comparison is factual and lists key features.
*   **Example Table**:
    ```html
    <table class="comparison-matrix">
      <thead>
        <tr>
          <th>Feature</th>
          <th>Icypluto</th>
          <th>Competitor X</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>AI Search Citation Tracker</td>
          <td>Yes (Real-time)</td>
          <td>No (SEO only)</td>
        </tr>
        <tr>
          <td>Credit-based API</td>
          <td>Yes (50 coins/run)</td>
          <td>No (Flat annual)</td>
        </tr>
      </tbody>
    </table>
    ```

### Step 3: Implement an FAQ Page / Component
Create a structured FAQ section at the bottom of the main page or in a dedicated `/faq` component.
*   **Action**: Write clear, direct question-and-answer pairs matching search intent.
*   **Format**: Use `<details>` and `<summary>` tags for native semantic accessibility, or use standard heading-paragraph structures.
    ```html
    <details class="faq-item">
      <summary><strong>Is Icypluto's MCP server free to use?</strong></summary>
      <p>Yes, the Icypluto Brand Visibility MCP server is free to install and integrate. Running individual audit tools deducts credits (Icy Coins) from your account.</p>
    </details>
    ```

---

> [!TIP]
> Ensure all reviews use real, honest statements. Avoid generating fake testimonials. Highlight authentic user feedback focusing on ease of use, support, and utility.
