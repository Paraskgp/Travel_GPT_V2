# Implementation Plan: Caching

## Owns

`lib/cache/index.ts` → `cacheRead()`, `cacheWrite()`, `boardCacheKey()`, `cacheStatus()`, `listCachedDestinations()`, `destinationSlug()`, `promptHash()`, `boardPromptHash()`, `contextPromptHash()`, `weatherPromptHash()`, `experiencesPromptHash()`, `candidateEnrichmentPromptHash()`

## Inputs / Outputs

```typescript
cacheRead<T>(destination: string, key: CacheKey, expectedHash?: string): T | null
cacheWrite<T>(destination: string, key: CacheKey, data: T, ttlDays: number, currentPromptHash?: string): void

// Per-stage granular prompt hashes
contextPromptHash(): string     // MD5 of destination-context.md
weatherPromptHash(): string     // MD5 of weather-context.md
experiencesPromptHash(): string // MD5 of experience-extractor-page.md + experience-dedup.md
candidateEnrichmentPromptHash(): string // MD5 of candidate-enrichment.md

type CacheKey =
  | "destination_context"
  | `weather_${string}`    // e.g. "weather_november"
  | "experiences"
  | "candidate_enrichment"
  | `board_${string}`      // e.g. "board_a3f2b1c4"
```

## On-disk format

```json
{
  "data": { ...the actual cached value... },
  "generated_at": "2026-05-27T14:32:00.000Z",
  "ttl_days": 180,
  "prompt_hash": "a3f2b1c4"   // stored by all stages that participate in hash validation
}
```

File path: `cache/destinations/{slug}/{key}.json`
Index file: `cache/_index.json` — registry of what's cached per destination

## Destination slug

```typescript
destinationSlug("Zion National Park")  // → "zion-national-park"
destinationSlug("Grand Canyon National Park, South Rim")  // → "grand-canyon-national-park-south-rim"
```
Lowercase, non-alphanumeric characters stripped, spaces → hyphens.

## Prompt hash — board (global) vs. per-stage (granular)

**Board:** `boardPromptHash()` — MD5 of board-relevant prompts only: `system.md`, `tip-enhancement.md`, `board-eval.md`, `candidate-enrichment.md`, and all files in `themes/`. Used as the board cache key (`board_{hash}`). Only changes that actually affect board output invalidate the board. Changing `destination-context.md`, `experience-extractor-page.md`, `query-generator.md`, or `weather-context.md` does NOT invalidate the board — those stages have their own independent hashes.

**`promptHash()`** still exists as a utility (MD5 of ALL prompts) but is no longer used as the board key. Kept for diagnostics.

**Per-stage:** `stageHash(entries[])` internal helper hashes specific files and/or directories relative to `prompts/`. When an entry is a directory, all `.md` files inside it are included sorted. Memoized via `Map<string, string>` keyed by sorted entry list.

Exported wrappers:
- `boardPromptHash()` — `system.md` + `themes/` dir + `tip-enhancement.md` + `board-eval.md`
- `contextPromptHash()` — `destination-context.md` only
- `weatherPromptHash()` — `weather-context.md` only
- `experiencesPromptHash()` — `experience-extractor-page.md` + `experience-dedup.md`
- `candidateEnrichmentPromptHash()` — `candidate-enrichment.md` only

## TTL behaviour

- `ttl_days > 0`: on read, check age. If `(now - generated_at) / 86400000 > ttl_days` → return null (expired)
- `ttl_days = -1`: never expires (permanent)

## Hash validation in cacheRead

`cacheRead` accepts an optional `expectedHash` parameter. Validation logic:

1. Entry has no stored `prompt_hash` → **keep** (backward compatible with pre-hash entries)
2. `expectedHash` is not provided → **keep** (caller opted out of hash checking)
3. Both stored hash and expected hash exist AND they differ → **reject** (prompt changed, regenerate)

The rejection path logs: `[cache] STALE {slug}/{key} (prompt changed: {old} → {new})`

## Failure handling

- `cacheRead`: returns `null` on missing file, expired TTL, stale prompt hash, or JSON parse error. Never throws.
- `cacheWrite`: logs a warning on failure. Never throws. Pipeline continues even if cache write fails.

## Unit tests

| Test | Covers success criterion |
|---|---|
| `cacheRead` returns null for missing file | Cache miss |
| `cacheRead` returns data for valid unexpired entry | Cache hit |
| `cacheRead` returns null for TTL-expired entry | TTL expiry |
| `cacheRead` returns data for TTL=-1 entry regardless of age | Permanent cache |
| `cacheRead` returns data when entry has no stored prompt_hash (backward compat) | Backward compatibility |
| `cacheRead` returns null when stored hash differs from expectedHash | Stale prompt rejection |
| `cacheRead` returns data when stored hash matches expectedHash | Hash validation pass |
| `cacheWrite` creates file at correct path with correct structure | Write correctness |
| `cacheWrite` does not throw on disk write failure | Non-fatal write |
| `destinationSlug` handles special characters and long names | Slug correctness |
| `promptHash` returns different value after any .md file changes | Prompt invalidation |
| `boardCacheKey` returns `board_{promptHash}` | Cache key format |
| `contextPromptHash` returns different value when destination-context.md changes | Per-stage invalidation |
| `experiencesPromptHash` returns different value when dedup prompt changes | Per-stage invalidation |
| `candidateEnrichmentPromptHash` returns different value when candidate-enrichment.md changes | Per-stage invalidation |

## Open technical items

- File-based cache — not horizontally scalable. Multiple server instances each have independent caches.
- No locking on concurrent writes — last write wins. Acceptable for current single-instance deployment.
- `_index.json` can become stale if cache files are deleted manually. No integrity check on startup.
- No automatic expiry cleanup — expired files accumulate. Must be pruned manually via `DELETE /api/cache`.
- `promptHash` is memoised per process — a prompt change during a running process won't be detected until restart.
