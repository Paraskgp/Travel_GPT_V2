# Module: Search & Scraping

## What it does

Takes the search queries from query generation and turns them into a set of annotated page contents ready for experience extraction. Tavily finds the relevant URLs AND provides the full scraped page text (`raw_content`). We do not scrape pages ourselves in the normal flow — Tavily is the scraper. A selective self-scrape fallback runs only for high-score URLs (≥ 0.7) where Tavily failed to return usable raw_content (blocked pages like Reddit).

This module is the bridge between "what should we search for" and "what real facts did we find." Its output quality directly determines whether extracted experiences have real distances, hours, permit requirements, and restaurant names — or just vague marketing copy.

## Inputs

- List of search query strings
- Destination slug (for cache key)
- Travel month (optional — scopes the cache key when event queries are included)

## Outputs

- A list of annotated results, each containing:
  - The originating query
  - Page title and URL
  - Relevance score (0–1, from Tavily)
  - Page content — Tavily `raw_content` preferred; selective self-scrape fallback for high-score blocked pages; Tavily snippet always prepended

## How it works

**Stage 1 — Tavily search (with cache):**
Check the search results cache first. On cache miss: run all queries in parallel, 3 results per query, request `raw_content: true`. Deduplicate by URL across all queries. Cache the raw results for 7 days. A re-run within 7 days (e.g. after dedup failure) reuses cached results and spends 0 Tavily credits.

**Stage 1b — Score filter:**
After Tavily search (or cache hit), discard results with `score < 0.5`. These low-confidence results contribute noise more than signal, and skipping them reduces the extraction batch by 20–30% with minimal loss of real experiences.

**Stage 2 — Content resolution (per URL):**
Priority order:
1. Tavily `raw_content` — full scraped page text. Guard: skip if content appears binary (starts with `data:` or has <40% readable characters)
2. Selective self-scrape — only triggered when raw_content is absent AND score ≥ 0.7. Cap at 4,000 characters.
3. Tavily snippet — always prepended as a prefix for any result; captures restaurant names from aggregator pages even when the full page is blocked

## Success criteria

- At least 60% of returned URLs yield usable content (>200 characters)
- No base64 binary content passes through to the extractor
- Tavily snippet is always included — zero results have an empty content field
- Total annotated result count: at least 15 for any destination with 8+ queries
- Re-runs within 90 days spend 0 Tavily API credits (cache hit)
- Score filter removes low-confidence results before extraction

## Evaluation criteria

- Content richness: what percentage of annotated results contain a numeric fact (distance, elevation, price, hours)?
- Failure rate: how many URLs returned only the Tavily snippet?
- Deduplication: are repeated URLs across different queries correctly collapsed to one result?
- Cache hit rate on re-runs

## Simplifying assumptions

- `include_raw_content: true` on every Tavily search — Tavily handles JS-rendered pages (Yelp, TripAdvisor)
- Self-scrape fallback is selective and rare — not the primary content source
- 8-second timeout per self-scrape URL
- Content cap at 40,000 characters sent to extractor (nav boilerplate beyond this point)
- Score filter threshold fixed at 0.5 — not tuned per destination

## Open items

- No headless browser / Playwright integration — JS-heavy sites blocked to Tavily fall back to snippet only
- No detection of paywalled content — some pages return only a paywall; pass through as snippet only
- Rate limiting not implemented on self-scrape — concurrent fetches to the same domain may get throttled
