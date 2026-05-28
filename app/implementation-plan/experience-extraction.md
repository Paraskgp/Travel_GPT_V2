# Implementation Plan: Experience Extraction

## Owns

`lib/pipeline/experiences.ts` → `extractExperiences(dest, annotatedResults, provider)`
`lib/pipeline/experiences.ts` → `getExperiences(dest, destCtx, provider)` — full pipeline with cache

## Inputs / Outputs

```typescript
extractExperiences(
  dest: string,
  annotatedResults: AnnotatedResult[],
  provider: Provider = "openai"
): Promise<GroundedExperience[]>

getExperiences(
  dest: string,
  destCtx: DestinationContext,
  provider: Provider = "openai"
): Promise<GroundedExperience[]>
// Returns [] on any failure — non-fatal
```

```typescript
interface GroundedExperience {
  name: string
  location: string      // specific: includes state + sub-location
  category: string      // "trail" | "restaurant" | "viewpoint" | "museum" | "tour" | ...
  key_facts: string[]   // 2–4 factual bullets, "Not found in search results" when missing
  source_url: string
}
```

## Steps — `getExperiences` (full pipeline)

1. `cacheRead(dest, "experiences")` — return if present
2. `generateQueries(dest, destCtx.applicable_themes, provider)`
3. `tavilyBatchSearch(queries, 3, true)` — 3 results per query, raw_content enabled
4. `scrapeUrls(urls)` — parallel fetch + strip
5. `annotateResults(searchResults, scraped)` — pure transform, no API calls
6. If `annotated.length === 0` → return `[]`
7. `extractExperiences(dest, annotated, provider)` — one LLM call
8. `cacheWrite(dest, "experiences", experiences, TTL.EXPERIENCES)` — 90 days
9. Return experiences

## Caching

- Key: `experiences`
- TTL: 90 days
- Invalidation: TTL expiry only (real-world experiences don't change when prompts change)
- File: `cache/destinations/{slug}/experiences.json`

## Failure handling

`getExperiences` catches all errors and returns `[]`. The board generation pipeline continues without grounding — cards are generated from LLM knowledge only (lower quality but not a failure).

`extractExperiences` throws on LLM failure — caught by `getExperiences`.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Cache hit skips all API calls and returns stored data | Cache correctness |
| Cache miss runs full pipeline and writes result | Full flow |
| Returns `[]` on Tavily failure (non-fatal) | Non-fatal failure |
| Returns `[]` on LLM failure (non-fatal) | Non-fatal failure |
| Extracted experiences have non-empty `name`, `location`, `category` | Basic shape validation |
| `location` includes state/country (not just the park name) | Location specificity |
| Output count between 10–25 for a destination with 29 queries | Expected output range |
| Experiences from `golden.specs.grounding.required` present in output | Required experience coverage |

## Open technical items

- One LLM call processes all annotated results — context window can be large (~80K tokens for Zion with 29 queries × 3 results). Gemini 2.5 Flash's 1M context window handles this.
- No programmatic check that `source_url` actually contains the extracted experience name
- No retry if count < 10
- `getExperiences` catches errors silently — in dev/scripts, errors should surface. Consider a `strict` mode parameter.
