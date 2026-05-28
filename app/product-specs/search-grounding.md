# Module: Search & Scraping

## What it does

Takes the search queries from query generation and turns them into a set of annotated page contents ready for experience extraction. Two-stage process: Tavily finds the relevant URLs; we fetch and clean the pages ourselves.

This module is the bridge between "what should we search for" and "what real facts did we find." Its output quality directly determines whether extracted experiences have real distances, hours, permit requirements, and restaurant names — or just vague marketing copy.

## Inputs

- List of search query strings

## Outputs

- A list of annotated results, each containing:
  - The originating query
  - Page title and URL
  - Cleaned page content (our scrape + Tavily fallback, always prepended with Tavily's short snippet)

## How it works

**Stage 1 — Tavily search:**
Run all queries in parallel. 3 results per query. Deduplicate by URL across all queries. Request `raw_content: true` as a fallback for JS-rendered pages.

**Stage 2 — Page scraping:**
For each unique URL, fetch the page ourselves and strip all noise: `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, `<aside>`. Cap at 4,000 characters of clean article text.

**Content selection per result (priority order):**
1. Our scraped text — cleanest, no nav/footer pollution
2. Tavily `raw_content` — handles JS-rendered pages (Yelp, TripAdvisor). Guard: skip if content appears to be base64 binary (starts with `data:` or has <40% readable characters)
3. Always prepend Tavily's short snippet regardless of which tier wins — the snippet captures restaurant names from aggregator pages even when the full page is blocked

## Success criteria

- At least 60% of queried URLs yield scraped text (>200 characters of clean content)
- No base64 binary content passes through to the extractor
- Tavily snippet is always included — zero results have an empty content field
- Total annotated result count: at least 15 for any destination with 8+ queries

## Evaluation criteria

- Content richness: what percentage of annotated results contain a numeric fact (distance, elevation, price, hours)?
- Failure rate: how many URLs returned only the Tavily snippet (our scrape failed and raw_content was binary or absent)?
- Deduplication: are repeated URLs across different queries correctly collapsed to one result?

## Simplifying assumptions

- 8-second timeout per URL — pages that take longer are skipped
- We do not handle JavaScript rendering — pages that require JS execution return empty or near-empty HTML. Tavily's raw_content is the fallback for these.
- No retry on scrape failure — if a URL times out or returns non-200, it is skipped
- Content cap at 4,000 characters — remainder of page is discarded

## Open items

- No headless browser / Playwright integration — JS-heavy sites (Yelp, OpenTable) always fall back to Tavily's raw_content or snippet
- No detection of paywalled content — some pages (NYT Travel, Condé Nast Traveler) return only a paywall. These pass through as snippets only.
- Rate limiting not implemented — concurrent fetches to the same domain may get throttled or blocked
