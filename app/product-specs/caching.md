# Module: Caching

## What it does

Stores pipeline outputs to disk so that repeat requests for the same destination skip expensive LLM and API calls. The cache is the primary mechanism for keeping the product fast and cheap at scale.

## Inputs

- Any pipeline output (destination context, weather context, experiences, board)
- Destination name (used to derive the cache key slug)
- TTL (time-to-live in days, or -1 for permanent)

## Outputs

- On write: a JSON file at `cache/destinations/{slug}/{key}.json`
- On read: the cached data, or `null` if the entry is missing, expired, or unreadable

## Cache keys and TTLs

| Key | TTL | Invalidated by | Prompt guard |
|---|---|---|---|
| `canonical_name` | Permanent | Never — name is stable | None (correct) |
| `destination_context` | 180 days | TTL expiry or prompt change | Hash of `destination-context.md` stored in entry; stale if hash differs |
| `weather_{month}` | Permanent | Prompt change only | Hash of `weather-context.md` stored in entry; stale if hash differs |
| `search_results_{month}` | 90 days | TTL expiry | None — intentional (Tavily credits are real money; manual clear required) |
| `experiences_{month}` | 90 days | TTL expiry or prompt change | Hash of extractor + dedup prompts stored in entry; stale if hash differs |
| `board_{prompt_hash}` | Permanent | Prompt file change (hash in key) | Hash of board-only prompts: `system.md` + `themes/*.md` + `tip-enhancement.md` + `board-eval.md` — other prompts (destination-context, weather, extractors) do not affect board output and do not invalidate it |

**How prompt-hash validation works for non-board stages:**
Each stage writes its own prompt hash into the cache entry's `prompt_hash` field. On read, `cacheRead` compares the stored hash to the current one. If they differ, the entry is treated as a cache miss and regenerated. If the stored entry has no hash (legacy entries), it is kept — backward compatible.

## Success criteria

- Cache hit returns data identical to what the pipeline would produce (no transformation on read)
- Cache miss triggers generation and writes the result before returning
- TTL expiry correctly causes a cache miss — expired entries are not returned
- Board cache correctly misses after any prompt file change
- Cache write failure is non-fatal — the pipeline returns the generated data even if it can't be cached

## Evaluation criteria

- Hit rate: what percentage of requests for warm destinations hit cache? Target: 100% for destination_context and weather on repeat requests.
- Correctness: cached data is structurally valid and matches the expected type
- Invalidation accuracy: prompt hash changes correctly cause board cache misses

## Simplifying assumptions

- File-based cache (local disk) — not a distributed cache (Redis, Memcached)
- One cache directory per destination slug — no namespacing by user or session
- Cache is shared across all requests — no per-user isolation
- Concurrent writes to the same cache key are not protected by a lock — last write wins

## Open items

- No distributed cache — this design does not scale to multiple server instances. Each instance has its own local cache. Requires a shared volume or distributed cache for horizontal scaling.
- No cache warming API for new destinations — `prefetch.ts` exists but requires manual invocation
- No automatic pruning of expired entries — disk usage grows until manually pruned
- `_index.json` registry can become stale if cache files are deleted manually
