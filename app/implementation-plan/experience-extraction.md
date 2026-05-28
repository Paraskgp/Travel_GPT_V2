# Implementation Plan: Experience Extraction

## Owns

`lib/pipeline/experiences.ts` → `generateQueries(dest, themes, provider)`
`lib/pipeline/experiences.ts` → `extractFromPage(result, provider)` → `RawExperience[]` — map step
`lib/pipeline/experiences.ts` → `dedupExperiences(candidates, dest, provider)` → `GroundedExperience[]` — reduce step
`lib/pipeline/experiences.ts` → `getExperiences(dest, destCtx, provider)` — full pipeline with cache

## Architecture — map-reduce

The extraction pipeline follows a strict map-reduce pattern. The previous architecture (one giant LLM call for all pages) was replaced after auditing showed:
- 83 pages concatenated = ~66k tokens input, Gemini's attention diluted across all sources
- Dedup and extraction conflated in one call — two separate concerns, one prompt
- All-or-nothing: single failure kills all experiences
- Blanket scraping was actively discarding content (our 4000-char cap vs Tavily's uncapped raw_content)

**Map phase (parallel):** one LLM call per search result, focused on one page at a time.
**Reduce phase (one LLM call):** receives flat list of named candidates, returns canonical deduplicated list.

```
generateQueries → tavilyBatchSearch → [Map: extractFromPage × N in parallel] → [Reduce: dedupExperiences] → GroundedExperience[]
```

## Inputs / Outputs

```typescript
// Map: one call per search result
extractFromPage(
  result: TavilyResult,   // {url, query, snippet, raw_content?, score}
  provider: Provider = "openai"
): Promise<RawExperience[]>
// Returns [] on failure — non-fatal per page

// Reduce: one call over all candidates
dedupExperiences(
  candidates: RawExperience[],
  dest: string,
  provider: Provider = "openai"
): Promise<GroundedExperience[]>

// Full pipeline with cache
getExperiences(
  dest: string,
  destCtx: DestinationContext,
  provider: Provider = "openai"
): Promise<GroundedExperience[]>
// Returns [] on any failure — non-fatal
```

```typescript
// Intermediate type — output of map phase, input to reduce
interface RawExperience {
  name: string           // specific named place or experience
  location: string       // as specific as the source allows
  category: string       // "trail" | "restaurant" | "viewpoint" | etc.
  key_facts: string[]    // 1–4 factual bullets extracted verbatim or closely paraphrased
  source_url: string     // the page this came from
}

// Final output — output of reduce phase
interface GroundedExperience {
  name: string
  location: string       // most specific version across all sources
  category: string
  key_facts: string[]    // richest merged set, deduplicated
  source_urls: string[]  // all pages that mentioned this experience
}
```

## Steps — `getExperiences` (full pipeline)

1. `cacheRead(dest, "experiences")` — return if present
2. `generateQueries(dest, destCtx.applicable_themes, provider)`
3. `tavilyBatchSearch(queries, 3, true)` — 3 results per query, raw_content enabled
4. **Map phase:** `Promise.allSettled(results.map(r => extractFromPage(r, provider)))`
   - Per result: resolve content = `raw_content ?? selective_scrape ?? snippet`
   - Selective scrape: only when `!raw_content && score >= 0.7`
   - LLM call: extract named experiences from this single page
   - Failed results: logged and skipped (non-fatal)
5. Flatten all `RawExperience[]` arrays → single candidate list
6. If `candidates.length === 0` → return `[]`
7. **Reduce phase:** `dedupExperiences(candidates, dest, provider)`
8. `cacheWrite(dest, "experiences", experiences, TTL.EXPERIENCES)` — 90 days
9. Return experiences

## Steps — `extractFromPage` (map)

1. Resolve content:
   - `raw_content` passes binary guard → use in full (no cap)
   - Else if `score >= 0.7 && !raw_content` → `scrapeUrl(url)` → use scraped text if `> 200 chars`
   - Prepend Tavily snippet (always available, captures aggregator page names)
2. Call LLM (stage: `"experience_extractor"` → Gemini 2.5 Flash)
3. System prompt: extract named real places from this single page, return `RawExperience[]`
4. Parse JSON → return array (or `[]` on parse failure)

## Steps — `dedupExperiences` (reduce)

1. Receives flat list of `RawExperience[]` — potentially 200–400 candidates with heavy duplication
2. LLM prompt: given these candidates from multiple sources, merge entries referring to the same real place, keep the richest facts, consolidate `source_urls`
3. System prompt: dedup-merge.md (a focused prompt, not a combined extract+dedup)
4. Return `GroundedExperience[]`

**Why LLM for dedup, not fuzzy matching:**
- "Angels Landing Trail", "Angels Landing Hike", "Angel's Landing" are the same place — trivial for LLM, hard for fuzzy string match
- "Upper Emerald Pool" and "Emerald Pools Trail (Upper)" — same, but different enough to fool edit-distance
- "Springdale Brewing Co." and "Zion Canyon Brew Pub" — possibly the same place, possibly not — requires semantic judgment
- Fuzzy matching would either over-merge (losing distinct experiences) or under-merge (keeping hundreds of near-duplicates)

**`dedupExperiences` is clean-swappable:** if embedding-based clustering or a cheaper deterministic approach is validated against quality later, the function signature doesn't change.

## Caching

- Key: `experiences`
- TTL: 90 days
- Invalidation: TTL expiry only (real-world experiences don't change when prompts change)
- File: `cache/destinations/{slug}/experiences.json`
- Note: map phase (per-page extraction) results are NOT individually cached — they are ephemeral inputs to the reduce step. Only the final `GroundedExperience[]` is cached.

## Failure handling

`getExperiences` catches all errors and returns `[]`. Board generation continues with LLM-only knowledge — lower quality but never a failure.

`extractFromPage` returns `[]` on any failure — non-fatal per page. One bad URL does not kill the map phase.

`dedupExperiences` throws on LLM failure — caught by `getExperiences`.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Cache hit skips all API calls and returns stored data | Cache correctness |
| Cache miss runs full pipeline and writes result | Full flow |
| Returns `[]` on Tavily failure (non-fatal) | Non-fatal failure |
| Returns `[]` on LLM failure in reduce phase (non-fatal) | Non-fatal failure |
| `extractFromPage` returns `[]` when content < 50 chars | Minimum content guard |
| `extractFromPage` failure on one page does not abort other pages | Per-page isolation |
| `dedupExperiences`: same experience from 3 sources → 1 record with 3 source_urls | Dedup correctness |
| `dedupExperiences`: genuinely different experiences are not merged | No over-merging |
| Extracted experiences have non-empty `name`, `location`, `category` | Basic shape validation |
| `location` includes state/country (not just the park name) | Location specificity |
| `source_urls` is non-empty for every GroundedExperience | Source attribution |
| Experiences from `golden.specs.grounding.required` present in output | Required experience coverage |

## Open technical items

- Map phase parallelism: 83 simultaneous Gemini calls may hit rate limits. Consider `p-limit` to cap concurrency (e.g., 20 concurrent).
- `extractFromPage` LLM output size: each page likely yields 1–8 experiences → well within 8192 token output budget for this stage.
- `dedupExperiences` input size: 400 RawExperience objects (names + locations + facts, no HTML) is small — fits comfortably in a single LLM call.
- No retry if final `GroundedExperience` count < 10.
- `getExperiences` catches errors silently — in dev/scripts, errors should surface. Consider a `strict` mode parameter.
