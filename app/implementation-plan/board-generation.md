# Implementation Plan: Board Generation

## Owns

`lib/pipeline/board.ts` → `generateBoard(dest, destCtx, weatherCtx, experiences, prefs, provider)`

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
2. **Wave 1 — Signature theme:**
   - `callLLM(themeSystemPrompt(), themeUserPrompt("signature", ..., experiences), provider, "board_generation")`
   - System prompt = `prompts/system.md` (card schema + quality rules)
   - Theme prompt = `prompts/themes/signature.md` (injected into user message)
3. **Wave 2 — All other themes in parallel:**
   - `Promise.allSettled(remainingThemes.map(themeId => callLLM(...)))`
   - Each call receives Signature's used experience list as blocklist
   - Failed themes logged and skipped
4. **Server-side deduplication:**
   - Collect all themes with results
   - For each experience across all themes: skip if `id` or `name` already seen (case-insensitive)
5. **Tip enhancement pass** (parallel per experience):
   - `callLLM(tipEnhancementSystemPrompt(), tipEnhancementUserPrompt(...), provider, "tip_enhancement")`
   - Routes to Gemini 2.5 Flash
   - Non-fatal: on failure, original `local_tip` is kept
6. **Places enrichment pass** (parallel, only if `GOOGLE_PLACES_API_KEY` set):
   - For each `is_mappable: true` experience: `enrichExperience(name, location_hint, dest)`
   - Attaches `places_enrichment` object; non-fatal on failure
7. `cacheWrite(dest, bKey, {themes, generated_at}, TTL.BOARD, promptHash)`
   - TTL = -1 (permanent until prompt hash changes)
8. Return `enhancedThemes`

## Caching

- Key: `board_{boardPromptHash()}` — e.g. `board_a3f2b1c4`
- TTL: -1 (permanent)
- Invalidation: only `system.md`, `themes/*.md`, `tip-enhancement.md`, or `board-eval.md` change the hash → cache miss. Changing `destination-context.md`, `weather-context.md`, or experience extractor prompts does NOT invalidate the board.
- File: `cache/destinations/{slug}/board_a3f2b1c4.json`
- Old board files accumulate until pruned via `DELETE /api/cache?destination=X`

## Failure handling

- Individual theme failures: logged, skipped. If all themes fail, returns `[]`.
- Tip enhancement failures: original tip kept. Never blocks board delivery.
- Places enrichment failures: `places_enrichment` stays `null`. Never blocks board delivery.
- The route does NOT catch `generateBoard` errors — a total failure returns HTTP 500.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Cache hit skips all LLM calls | Cache correctness |
| Cache invalidates when a prompt .md file changes | Prompt hash invalidation |
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
