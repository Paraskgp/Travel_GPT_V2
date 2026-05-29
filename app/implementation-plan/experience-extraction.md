# Implementation Plan: Experience Extraction

## Owns

`lib/pipeline/experiences.ts` → `generateQueries(dest, themes, travelMonth, provider)`
`lib/pipeline/experiences.ts` → `extractFromPage(result, provider)` → `RawExperience[]` — map step
`lib/pipeline/experiences.ts` → `dedupExperiences(candidates, dest, provider)` → `GroundedExperience[]` — reduce step
`lib/pipeline/experiences.ts` → `getExperiences(dest, destCtx, travelMonth, provider)` — full pipeline with cache

### Date-aware event queries

When `travelMonth` is provided, the query generator adds a dedicated event query batch alongside the theme queries:

- `"[destination] [month] events festivals 2026"` — broad event sweep
- `"[destination] sports tournament [month] tickets"` — major sporting events (sumo basho, baseball, football, tennis)
- `"[destination] concerts music festival [month]"` — music and arts events
- `"[destination] public holiday [month] special events"` — national holidays, special openings

Without `travelMonth`, these queries are omitted. The experiences cache key includes the travel month slug so month-specific results don't bleed into cached boards for different months.

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
  dest: string,           // destination name — used to filter off-topic extractions
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

1. Resolve content (`resolveContent(result)`):
   - `raw_content` passes binary guard (length > 200, no binary data prefix, readable char ratio > 0.4) → use in full
   - Else if `score >= 0.7 && !raw_content` → `scrapeUrl(url)` → use scraped text if `> 200 chars`
   - Always prepend Tavily snippet (aggregator pages carry clean names in the snippet even when raw_content is absent)
2. **Truncate content to 40k characters** — pages beyond this threshold are navigation/ads/boilerplate, not additional named experiences. Prevents extractor output overflow on 100k+ char pages.
3. If resolved content length < 50 chars → return `[]` immediately
4. Call LLM (stage: `"experience_extractor"` → Gemini 2.5 Flash, max_tokens: 16384)
5. System prompt: `prompts/experience-extractor-page.md` — extract named real places from this single page for `dest`, return `RawExperience[]`
6. Parse JSON → return array (or `[]` on parse failure — non-fatal)

## Steps — `dedupExperiences` (reduce)

1. **Step 0 — Relevance filter (deterministic):** drop candidates whose `name` and `location` contain no meaningful word from the destination name (length > 3). Removes off-destination noise extracted from comparison articles (e.g. "Yosemite National Park" extracted from an AccuWeather article about Zion weather). Logged: `N → M candidates after relevance filter`.

2. **Step 1 — Pre-dedup by normalized name (deterministic, `preDedupByName`):**
   - Normalize: lowercase, strip punctuation/apostrophes, collapse whitespace
   - Group exact normalized matches → one canonical entry per name
   - Per group: keep richest `location` (longest), union all `key_facts`, collect all `source_url` values
   - Result: ~500 candidates → ~80–100 unique names before the LLM sees anything
   - Logged: `M → K candidates after pre-dedup`

3. **Step 2 — URL tracking:** build `urlsByName` map from pre-grouped list, keyed by normalized name. Source URLs are **stripped entirely from LLM input and output** — they bloat the JSON output and cause output truncation. The LLM never sees or returns URLs.

4. **Step 3 — LLM semantic dedup (one call — input is name/location/category only):**
   - `key_facts` are **stripped from the LLM input** — the merge decision only needs name + location + category + LLM world knowledge. Sending key_facts (3–4 bullets × 100 chars × 400 entries = ~60k token input) was the root cause of the token overflow crash.
   - `factsByName` map is built from the pre-grouped list in parallel with `urlsByName` — same lookup pattern, keyed by normalized name.
   - LLM input: `{ name, location, category }[]` (no `source_url`, no `key_facts`)
   - Stage: `"experience_dedup"` → Gemini 2.5 Flash, max_tokens: 65536 (thinking tokens + output; now well within budget since input is ~10k tokens)
   - System prompt: `prompts/experience-dedup.md` — handles true name variations ("Angel's Landing" vs "Angels Landing Hike") that the deterministic step can't catch
   - Output: `{ name, location, category }[]` — no `key_facts`, no `source_urls`

5. **Step 4 — Stitch-back (deterministic):** for each LLM canonical name, look up both `source_urls` (from `urlsByName`) and `key_facts` (from `factsByName`). Exact normalized match first; fall back to substring match. Attach as `source_urls: string[]` and `key_facts: string[]` on the final `GroundedExperience`.

6. Return `GroundedExperience[]`

**Why LLM for dedup, not fuzzy matching:**
- "Angels Landing Trail", "Angels Landing Hike", "Angel's Landing" are the same place — trivial for LLM, hard for fuzzy string match
- "Upper Emerald Pool" and "Emerald Pools Trail (Upper)" — same, but different enough to fool edit-distance
- "Springdale Brewing Co." and "Zion Canyon Brew Pub" — possibly the same place, possibly not — requires semantic judgment
- Fuzzy matching would either over-merge (losing distinct experiences) or under-merge (keeping hundreds of near-duplicates)

**`dedupExperiences` is clean-swappable:** the function signature is stable. Internals (LLM → embeddings → whatever) can be replaced without changing any caller.

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

- **[DONE 2026-05-28]** Map phase parallelism: `runWithConcurrency(items, 20, fn)` caps parallel Gemini calls at 20. Prevents rate-limit exhaustion on free tier.
- **[DONE 2026-05-28]** Gemini dedup truncation (output): Gemini 2.5 Flash uses thinking tokens against max_tokens budget. Fixed by setting dedup stage to 65536 (model ceiling) and stripping source_urls from LLM I/O.
- **[DONE 2026-05-29]** Gemini dedup crash for large cities (input overflow): root cause was sending full key_facts arrays in the LLM dedup input. 400 pre-grouped candidates × ~600 chars of pretty-printed JSON with key_facts = ~60k token input, overwhelming the model before output even starts. Fix: strip key_facts from LLM dedup I/O entirely. key_facts are tracked in a `factsByName` map (same pattern as `urlsByName`) and stitched back deterministically after dedup. LLM input drops to ~10k tokens regardless of candidate count.
- **[DONE 2026-05-28]** Content truncation: extractor content capped at 40k chars. Extractor output limit raised from 8192 → 32768 (Gemini 2.5 Flash thinking tokens consume the budget before producing visible output — 16384 was still insufficient for dense pages). Verified: undercanvas.com now extracts 37 experiences (was 0), noahlangphotography.com extracts 19 (was 0).
- **[PENDING 2026-05-28]** Category taxonomy is free-form. LLM produces inconsistent strings ("canyoneering" vs "canyoneering tour" vs "canyoneering / trail"). Add a closed enum to the extractor prompt.
- No retry if final `GroundedExperience` count < 30. (2026-05-28)
- `getExperiences` catches errors silently — in dev/scripts, errors should surface. Consider a `strict` mode parameter. (2026-05-28)
