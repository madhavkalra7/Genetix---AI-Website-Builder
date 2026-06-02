# Structured Schema Optimization Guide

Search engine crawlers and LLMs rely on structured metadata to establish brand entities. By injecting Schema.org JSON-LD blocks, you explicitly define the brand name, description, social handles, founders, products, and target audience, ensuring search algorithms index the brand correctly and display knowledge graphs.

This guide provides templates and instructions for you (the AI Agent) to programmatically generate and inject JSON-LD schemas into the website codebase.

---

## 📋 Recommended Schemas & Templates

### 1. Organization Schema
Place this on the main home/landing page of the website. It establishes the company's identity.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Icypluto",
  "alternateName": ["Pluto Brand Tracker", "Icypluto App"],
  "url": "https://icypluto.com",
  "logo": "https://icypluto.com/logo.png",
  "description": "An AI-powered brand visibility, SOV, and competitor tracker built to audit search engine mentions.",
  "sameAs": [
    "https://twitter.com/icypluto",
    "https://github.com/icypluto",
    "https://www.linkedin.com/company/icypluto"
  ],
  "founder": {
    "@type": "Person",
    "name": "Icypluto Founder"
  }
}
```

### 2. SoftwareApplication (SaaS) Schema
If the website represents a SaaS application or digital tool, define the application schema to boost product reviews visibility.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Icypluto Brand Visibility Tracker",
  "operatingSystem": "All",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "49.00",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "120"
  }
}
```

---

## 🛠️ Step-by-Step Agent Injection Workflow

Follow these steps to generate and inject structured data into the workspace:

### Step 1: Collect Brand Details
Query or crawl the website files to extract:
*   Official name & alternate names
*   Logo file path or URL
*   Core description
*   Social media profile URLs

### Step 2: Select Injection Target
Identify the template system of the site:
*   **Next.js (App Router)**: Add it to the root `app/layout.tsx` (or target page layout) by rendering it inside a standard `<script>` tag:
    ```tsx
    export default function RootLayout({ children }) {
      const schemaData = { /* Schema JSON */ };
      return (
        <html lang="en">
          <head>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
            />
          </head>
          <body>{children}</body>
        </html>
      );
    }
    ```
*   **Static HTML / Vite**: Locate the main `index.html` file and append the script block before the closing `</head>` tag.

### Step 3: Validate Code Changes
*   Ensure that JSON-LD is properly escaped to avoid syntax issues.
*   Ensure there are no trailing commas in the JSON block, which will cause search engines to reject the script.

---

> [!TIP]
> Use multiple schemas combined in a single array or referenced via `@graph` inside a single script tag to reduce code footprint.
