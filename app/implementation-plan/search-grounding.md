# Implementation Plan: Search & Scraping

## Owns

`lib/tavily/client.ts` → `tavilySearch()`, `tavilyBatchSearch()`
`lib/scraper/client.ts` → `scrapeUrl()`, `scrapeUrls()`

The scraper is a utility — it is NOT a mandatory pipeline step. See the scraper role decision below.

## Inputs / Outputs

```typescript
// Tavily
tavilyBatchSearch(
  queries: string[],
  maxResultsPerQuery: number = 5,
  includeRawContent: boolean = false
): Promise<TavilyResult[]>
// URL-deduped flat list of results across all queries

// Scraper (selective enrichment only — not blanket)
scrapeUrl(url: string): Promise<ScrapeResult>
scrapeUrls(urls: string[]): Promise<ScrapeResult[]>
```

```typescript
interface TavilyResult {
  title: string; url: string; content: string  // short snippet
  raw_content?: string; score: number; query?: string
}

interface ScrapeResult {
  url: string; text: string; ok: boolean; error?: string
}
```

## Scraper role — decision and reasoning

**The scraper is kept as a utility module but removed from the primary pipeline path.**

Why it was built:
- Tavily does not always return `raw_content` — some results come back snippet-only
- For high-signal URLs where Tavily has only a snippet, a targeted fetch adds real content
- Belt-and-suspenders for URL types Tavily doesn't cache well

Why blanket scraping of all results was removed:
- Empirically (audited 2026-05-27 on Zion, 83 results): Tavily `raw_content` is already available for most high-quality pages and is richer than our scrape. `brookebeyond.com` returned `raw_content: 115835c` from Tavily; our scraper returned `4000c` for the same page — we actively discarded 111k chars.
- Our scraper caps at 4000 chars. Tavily raw_content has no cap. For any page where both sources are available, Tavily wins.
- Pages that resist Tavily raw_content (Reddit, Facebook, TikTok, Yelp) also resist our scraper — they block crawlers at the HTTP layer. Spending a fetch on them is pure waste.
- Blanket scraping added latency (parallel fetch of 83 URLs) and complexity with negative net content impact.

When the scraper IS used:
- Selectively, for results where `raw_content` is missing AND `score >= 0.7`
- Driven by the map phase of experience extraction — if a high-score result has no raw_content, the map call triggers `scrapeUrl` for that specific URL before extraction
- This is O(missing_raw_content_count) fetches, not O(all_results)

## Steps

**Tavily batch search (with cache):**
1. Check `search_results` (or `search_results_{month}`) cache — return immediately on hit
2. On cache miss: run all queries in parallel via `Promise.allSettled`
3. Deduplicate results by URL — first occurrence wins, query name preserved
4. Failed individual queries are logged and skipped (not fatal)
5. Write raw results to cache (7-day TTL) before returning

**Score filter (before extraction):**
- Discard results with `score < 0.5` — these are low-confidence, noise-heavy
- Log filtered count: `[search-grounding] score filter: N → M results (K discarded)`

**Selective scraping (per-result, triggered by map phase):**
1. Called per-result only when: `!result.raw_content && result.score >= 0.7`
2. Per URL: fetch with 8-second timeout and browser-like User-Agent
3. Strip block tags: `script, style, nav, footer, header, aside, noscript, iframe, svg`
4. Convert block-level HTML to newlines, strip remaining tags, decode entities, collapse whitespace
5. Return `ScrapeResult` — caller decides whether to use it

**Content priority per result (resolved in map phase):**
1. `raw_content` from Tavily (if present and passes binary guard) — primary, no cap
2. Scraped text (if selective scrape triggered and returned > 200 chars)
3. Tavily snippet — always available, always prepended

**Binary content guard (applied to raw_content before use):**
- `length > 200`
- Does not start with `"data:"`
- Readable char ratio `> 0.40` (letters + punctuation / total)

## Caching

| Key | TTL | Invalidation |
|---|---|---|
| `search_results` | 90 days | Manual cache clear or TTL expiry |
| `search_results_{month}` | 90 days | Manual cache clear or TTL expiry |

Stores the full `TavilyResult[]` array including `raw_content`. Re-runs within 90 days (e.g. after a dedup failure, prompt iteration, or board regeneration) skip all Tavily API calls and reuse cached page text. Same TTL as experiences — if experiences are still valid, the source data they came from is equally valid.

## Failure handling

- Individual Tavily query failures: logged, skipped, other queries continue
- Individual scrape failures: `ok=false`, filtered out, Tavily content used instead
- Total failure (all queries fail): `tavilyBatchSearch` returns `[]`, `getExperiences` returns `[]`

## Unit tests

| Test | Covers success criterion |
|---|---|
| URL deduplication: same URL from two queries appears once | Dedup correctness |
| Base64 raw_content does not pass through binary guard | Binary content guard |
| Scrape failure returns `ok=false`, not a throw | Non-fatal scrape |
| Readable char ratio guard rejects content with <40% letters/punctuation | Binary guard |
| Selective scrape: only triggered when `!raw_content && score >= 0.7` | Scraper is selective |
| Selective scrape: NOT triggered when raw_content is present | Scraper is not blanket |
| Search results cache hit: Tavily API is not called on re-run within 7 days | Cache hit |
| Score filter: results with score < 0.5 are excluded before extraction | Score filter |

## Open technical items

- 8-second timeout per URL — some legitimate slow pages may time out
- No JS rendering — Yelp, OpenTable, TripAdvisor pages return near-empty HTML (Tavily snippet is the fallback)
- Score threshold for selective scraping (0.7) is a heuristic — not validated against outcome quality
- Score filter threshold (0.5) is a heuristic — not validated; may need tuning for specific destination types
- Search results cache stores full raw_content — cache files can be large (10-50MB for busy destinations)
- `raw_content` enabled by default in `tavilyBatchSearch` — acceptable trade-off since raw_content replaces the blanket scrape
- [2026-06-01] Added search results cache (7-day TTL) and score filter (≥0.5) to reduce Tavily spend on re-runs
