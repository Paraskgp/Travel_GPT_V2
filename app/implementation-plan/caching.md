# Implementation Plan: Caching

## Owns

`lib/cache/index.ts` → `cacheRead()`, `cacheWrite()`, `boardCacheKey()`, `cacheStatus()`, `listCachedDestinations()`, `destinationSlug()`, `promptHash()`

## Inputs / Outputs

```typescript
cacheRead<T>(destination: string, key: CacheKey): T | null
cacheWrite<T>(destination: string, key: CacheKey, data: T, ttlDays: number, currentPromptHash?: string): void

type CacheKey =
  | "destination_context"
  | `weather_${string}`    // e.g. "weather_november"
  | "experiences"
  | `board_${string}`      // e.g. "board_a3f2b1c4"
```

## On-disk format

```json
{
  "data": { ...the actual cached value... },
  "generated_at": "2026-05-27T14:32:00.000Z",
  "ttl_days": 180,
  "prompt_hash": "a3f2b1c4"   // only on board entries
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

## Prompt hash

MD5 of all `.md` files in `prompts/` directory, sorted alphabetically, first 8 hex chars. Computed once per process (memoised in `_cachedPromptHash`). Process restart recomputes it (picks up new prompts).

## TTL behaviour

- `ttl_days > 0`: on read, check age. If `(now - generated_at) / 86400000 > ttl_days` → return null (expired)
- `ttl_days = -1`: never expires (permanent)

## Failure handling

- `cacheRead`: returns `null` on missing file, expired TTL, or JSON parse error. Never throws.
- `cacheWrite`: logs a warning on failure. Never throws. Pipeline continues even if cache write fails.

## Unit tests

| Test | Covers success criterion |
|---|---|
| `cacheRead` returns null for missing file | Cache miss |
| `cacheRead` returns data for valid unexpired entry | Cache hit |
| `cacheRead` returns null for TTL-expired entry | TTL expiry |
| `cacheRead` returns data for TTL=-1 entry regardless of age | Permanent cache |
| `cacheWrite` creates file at correct path with correct structure | Write correctness |
| `cacheWrite` does not throw on disk write failure | Non-fatal write |
| `destinationSlug` handles special characters and long names | Slug correctness |
| `promptHash` returns different value after any .md file changes | Prompt invalidation |
| `boardCacheKey` returns `board_{promptHash}` | Cache key format |

## Open technical items

- File-based cache — not horizontally scalable. Multiple server instances each have independent caches.
- No locking on concurrent writes — last write wins. Acceptable for current single-instance deployment.
- `_index.json` can become stale if cache files are deleted manually. No integrity check on startup.
- No automatic expiry cleanup — expired files accumulate. Must be pruned manually via `DELETE /api/cache`.
- `promptHash` is memoised per process — a prompt change during a running process won't be detected until restart.
