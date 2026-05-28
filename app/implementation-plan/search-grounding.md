# Implementation Plan: Search & Scraping

## Owns

`lib/tavily/client.ts` → `tavilySearch()`, `tavilyBatchSearch()`
`lib/scraper/client.ts` → `scrapeUrl()`, `scrapeUrls()`
`lib/pipeline/experiences.ts` → `annotateResults(searchResults, scraped)`

## Inputs / Outputs

```typescript
// Tavily
tavilyBatchSearch(
  queries: string[],
  maxResultsPerQuery: number = 5,
  includeRawContent: boolean = false
): Promise<TavilyResult[]>
// URL-deduped flat list of results across all queries

// Scraper
scrapeUrls(urls: string[]): Promise<ScrapeResult[]>
// Parallel fetch + HTML strip. Returns only successful results (ok=true, text>100 chars).

// Annotator (pure function — no API calls)
annotateResults(
  searchResults: TavilyResult[],
  scraped: ScrapeResult[]
): AnnotatedResult[]
```

```typescript
interface TavilyResult {
  title: string; url: string; content: string  // short snippet
  raw_content?: string; score: number; query?: string
}

interface ScrapeResult {
  url: string; text: string; ok: boolean; error?: string
}

interface AnnotatedResult {
  query: string; title: string; url: string; content: string
}
```

## Steps

**Tavily batch search:**
1. Run all queries in parallel via `Promise.allSettled`
2. Deduplicate results by URL — first occurrence wins, query name preserved
3. Failed individual queries are logged and skipped (not fatal)

**Page scraping:**
1. `Promise.all(urls.map(scrapeUrl))` — fully parallel
2. Per URL: fetch with 8-second timeout and browser-like User-Agent
3. Strip block tags: `script, style, nav, footer, header, aside, noscript, iframe, svg`
4. Convert block-level HTML to newlines, strip remaining tags, decode entities, collapse whitespace
5. Cap at 4,000 characters
6. Return only `ok=true` results with `text.length > 100`

**Annotation (pure transform):**
For each search result, build content string:
1. Tavily snippet always included first (captures restaurant names from aggregator pages)
2. Try our scraped text (>200 chars) → use as page content
3. Else try Tavily `raw_content`:
   - Guard: `length > 200 && !startsWith("data:") && readable_char_ratio > 0.40`
   - Use first 3,500 chars if passes guard
4. Final content = `snippet + "\n\n" + pageContent` (or snippet alone if no page content)
5. Filter: drop results where `content.length < 50`

## Caching

None at this layer. The experience extraction output is cached — the search and scrape steps are ephemeral inputs to it.

## Failure handling

- Individual Tavily query failures: logged, skipped, other queries continue
- Individual scrape failures: `ok=false`, filtered out, Tavily fallback used
- Total failure (all queries fail): `tavilyBatchSearch` returns `[]`, `getExperiences` returns `[]`

## Unit tests

| Test | Covers success criterion |
|---|---|
| URL deduplication: same URL from two queries appears once | Dedup correctness |
| Base64 raw_content does not pass through annotator | Binary content guard |
| Snippet always present in annotated content even when scrape fails | Snippet always prepended |
| Scrape failure returns `ok=false`, not a throw | Non-fatal scrape |
| annotateResults filters out results with content.length < 50 | Minimum content filter |
| Readable char ratio guard rejects content with <40% letters/punctuation | Binary guard |

## Open technical items

- 8-second timeout per URL — some legitimate slow pages (parks.gov, etc.) may time out
- No JS rendering — Yelp, OpenTable, TripAdvisor pages return near-empty HTML
- No rate limiting on concurrent fetches — could get IP-blocked by some servers
- `raw_content` enabled by default in `tavilyBatchSearch` call — doubles Tavily token usage
