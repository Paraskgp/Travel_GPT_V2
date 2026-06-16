# Implementation Plan: Board Generation

## Owns

- `lib/pipeline/board.ts` → `generateBoard(dest, destCtx, weatherCtx, experiences, prefs, provider)`
- `lib/pipeline/experience-curation.ts` → `curateExperiencesForBoard(experiences, destContext, themeIds)`
- `lib/pipeline/candidate-enrichment.ts` → `enrichPromisingCandidatesForBoard(experiences, initialCuration, dest, destContext, provider)`

## Inputs / Outputs

```typescript
generateBoard(
  dest: string,
  destCtx: DestinationContext,
  weatherCtx: WeatherContext | null,
  experiences: GroundedExperience[],  // [] if grounding failed
  prefs: Preferences,                  // party_type already stripped by caller
  provider: Provider = "openai"
): Promise<Theme[]>
```

```typescript
interface Theme {
  id: string; name: string; description: string
  experiences: Experience[]
}
// party_type is stripped by the route before calling generateBoard
// Board is universal — same board for all party types

interface CuratedExperienceResult {
  byTheme: Record<string, GroundedExperience[]>
  audit: CuratedExperienceAuditEntry[]
  stats: CuratedExperienceStats
}

interface CuratedExperienceAuditEntry {
  experience: GroundedExperience
  status: "candidate" | "excluded_from_board" | "fold_into_parent"
  reason: string | null
  parent_name: string | null
  score: number
  matching_themes: string[]
}

interface CandidateEnrichmentResult {
  experiences: GroundedExperience[]
  audit: CandidateEnrichmentAuditEntry[]
  stats: CandidateEnrichmentStats
}
```

## Theme registry

11 themes: `signature`, `unique_local`, `food`, `culture`, `arts`, `outdoor`, `adventure`, `shopping`, `nightlife`, `day_trips`, `seasonal`

Removed as themes (now card-level attributes): `rainy_day` → `weather_sensitivity`, `family` → `suitability_tags: family_friendly`, `romantic` → `suitability_tags: romantic`

Merged: `food_drink` + `food_crawls` → `food` | `nature` + `hiking` → `outdoor`

## Steps

0. **Route-level board cache pre-check** (in `route.ts`, before `getExperiences`):
   - `cacheRead(dest, boardCacheKey())` — if hit, return immediately using cached board + already-fetched destCtx + weatherCtx. Experiences pipeline is **skipped entirely**.
   - This matters because `getExperiences` is expensive (10+ min for a new month key). Running it before a board cache check wastes that time on data that will be discarded.
1. `cacheRead(dest, boardCacheKey())` — (called again inside generateBoard as safety net) return `cached.themes` if present
   - Cache key includes prompt hash: `board_{8-char-md5-of-all-.md-files}`
2. **Initial candidate curation:**
   - `curateExperiencesForBoard(experiences, destCtx, applicableThemes)`
   - Full `GroundedExperience[]` is preserved in memory for audit; the function returns initial per-theme prompt candidates and an audit list.
   - Exact duplicate names are collapsed for prompt input only by choosing the richest version.
   - Non-board entities are flagged as `excluded_from_board`, not deleted. Reasons include `not_trip_worthy`, `infrastructure_or_service`, `low_signal_fragment`, and `no_matching_board_theme`.
   - Child/detail entities are flagged as `fold_into_parent` when they are likely sub-areas or sub-attractions of a stronger parent candidate. Their key facts are copied into the parent candidate before prompt input.
   - Board-worthiness is generic: would a traveler from another city/country reasonably spend 1–3 hours including transit overhead on this as a destination experience?
   - Per-theme candidate sets target 20–30 entries, with smaller sets when fewer qualified entries exist. Food may retain a broader inventory until restaurant clustering exists.
3. **Pre-board candidate enrichment:**
   - `enrichPromisingCandidatesForBoard(experiences, initialCuration, dest, destCtx, provider)`
   - Selects a capped set of promising targets from initial candidates plus uncertain exclusions (`not_trip_worthy`, `low_signal_fragment`, `no_matching_board_theme`). Obvious infrastructure/service exclusions are not researched.
   - For each selected target:
     - Calls `enrichExperience(name, location, dest)` to attach Google Places signals to facts: rating, review count, official website, business status, hours, editorial summary, review snippets, and place type.
     - Runs up to 2 targeted Tavily searches: official-site/logistics and reviews/visit-duration.
     - Reuses the existing search content resolver from `lib/pipeline/experiences.ts` so Tavily `raw_content`, selective scrape fallback, snippet fallback, and URL handling stay consistent with the broad extraction pipeline.
     - Uses `prompts/candidate-enrichment.md` to extract a short list of factual bullets from targeted search content.
   - Returns a new `GroundedExperience[]` with enriched facts and source URLs merged into the original records. Original records are never deleted.
   - Non-fatal: if Places, Tavily, or LLM extraction fails for a target, the original record is preserved.
4. **Final candidate curation:**
   - `curateExperiencesForBoard(enrichedExperiences, destCtx, applicableThemes)`
   - This final curation result is what board theme prompts receive and what gets persisted as `curation_audit`.
5. **Wave 1 — Signature theme:**
   - `callLLM(themeSystemPrompt(), themeUserPrompt("signature", ..., curated.byTheme.signature), provider, "board_generation")`
   - System prompt = `prompts/system.md` (card schema + quality rules)
   - Theme prompt = `prompts/themes/signature.md` (injected into user message)
6. **Wave 2 — All other themes in parallel:**
   - `Promise.allSettled(remainingThemes.map(themeId => callLLM(...)))`
   - Each call receives Signature's used experience list as blocklist
   - Each call receives only its curated candidate set, not the full verified pool
   - Failed themes logged and skipped
7. **Server-side deduplication:**
   - Collect all themes with results
   - For each experience across all themes: skip if `id` or `name` already seen (case-insensitive)
8. **Tip enhancement pass** (parallel per experience):
   - `callLLM(tipEnhancementSystemPrompt(), tipEnhancementUserPrompt(...), provider, "tip_enhancement")`
   - Routes to Gemini 2.5 Flash
   - Non-fatal: on failure, original `local_tip` is kept
9. **Places enrichment pass** (parallel, only if `GOOGLE_PLACES_API_KEY` set):
   - For each `is_mappable: true` experience: `enrichExperience(name, location_hint, dest)`
   - Attaches `places_enrichment` object; non-fatal on failure
10. `cacheWrite(dest, bKey, {themes, generated_at}, TTL.BOARD, promptHash)`
   - TTL = -1 (permanent until prompt hash changes)
11. Return `enhancedThemes`

## Caching

- Key: `board_{boardPromptHash()}_{curationVersion}` — e.g. `board_a3f2b1c4_c4`
- TTL: -1 (permanent)
- Invalidation: `system.md`, `themes/*.md`, `tip-enhancement.md`, `board-eval.md`, or `candidate-enrichment.md` change the hash → cache miss. Curation/enrichment semantic changes bump the curation version suffix. Changing `destination-context.md`, `weather-context.md`, or experience extractor prompts does NOT invalidate the board.
- File: `cache/destinations/{slug}/board_a3f2b1c4.json`
- Old board files accumulate until pruned via `DELETE /api/cache?destination=X`
- Candidate enrichment cache: `candidate_enrichment` stores per-experience targeted research results for the destination, keyed by normalized experience name and the candidate-enrichment prompt hash. A board cache miss should reuse this cache before spending Places/Tavily/LLM calls again.

## Failure handling

- Individual theme failures: logged, skipped. If all themes fail, returns `[]`.
- Pre-board enrichment failures: original `GroundedExperience` records are kept. Never blocks board delivery.
- Tip enhancement failures: original tip kept. Never blocks board delivery.
- Places enrichment failures: `places_enrichment` stays `null`. Never blocks board delivery.
- The route does NOT catch `generateBoard` errors — a total failure returns HTTP 500.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Cache hit skips all LLM calls | Cache correctness |
| Cache invalidates when a prompt .md file changes | Prompt hash invalidation |
| Candidate curation preserves all inputs in audit | No silent discard |
| Infrastructure/pass/service entries are excluded with reasons | Board-worthiness filter |
| Child entries fold into parent candidate facts | Parent-child consolidation |
| Thin promising candidate is enriched before final curation | Pre-board enrichment |
| Infrastructure/service exclusions are not selected for enrichment | Cost control |
| Enrichment failure preserves original experience | Non-fatal enrichment |
| Per-theme candidates stay within prompt budget target | Prompt input control |
| No experience ID appears in more than one theme | Cross-theme deduplication |
| All themes from `destCtx.applicable_themes` appear in output | Theme coverage |
| Experiences from `golden.specs.board.required` present | Required experiences |
| Experiences from `golden.specs.board.forbidden` absent | No hallucinations |
| `is_mappable: true` experiences have `places_enrichment` when key is set | Enrichment coverage |
| `local_tip` fields do not contain banned phrases after tip enhancement | Tip quality |

## Experience ordering

Ranking is entirely prompt-driven — the LLM returns experiences in ranked order and the pipeline preserves array order exactly (no post-sort step). The ranking instruction lives in `prompts/system.md` under "## Experience Ranking". Criteria in descending priority: must-cover first → destination-unique → broadly accessible → niche/conditional last. Preferences shift ranking within this order; they do not override the inherent destination hierarchy.

## Open technical items

- `party_type` stripping done by the route caller (`boardPrefs()`) — not enforced inside `generateBoard`. If a future caller forgets to strip it, board cache may be keyed incorrectly.
- No post-generation self-critique pass to catch hallucinations that slipped through the extractor (P4)
- Tip enhancement runs serially per experience within each theme's `Promise.all` — total enhancement time scales linearly with experience count (~60 tips = 60 LLM calls in parallel batches)
- Curation audit is persisted with the board cache and returned by `generateBoard`, but it is not yet surfaced in a reviewer UI.
- Restaurant inventory still uses board curation as a bridge; a dedicated restaurant-by-cuisine-by-cluster module should replace this for itinerary meal selection.

## Completed

- **[DONE 2026-06-16]** Pre-board candidate enrichment added between initial and final curation. It reuses Places, Tavily, shared search-result content resolution, prompt loading, parseJSON, and destination cache; failures preserve original experiences.
