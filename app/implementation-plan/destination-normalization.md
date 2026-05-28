# Implementation Plan: Destination Normalization

**Last updated:** 2026-05-28

---

## Owns

`lib/pipeline/destination-normalization.ts` → `normalizeDestination(raw, provider)` → `string`

Called at the very top of `app/api/generate/route.ts`, before any other pipeline function. The returned canonical string replaces `dest` for all downstream calls.

---

## Inputs / Outputs

```typescript
normalizeDestination(
  raw: string,          // raw user input — anything from "Zion" to "Xayan"
  provider: Provider = "openai"
): Promise<string>
// Returns canonical name on success, raw input on LLM failure (non-fatal fallback)
```

---

## Steps

1. `cacheRead(raw, "canonical_name")` — if hit, return cached canonical immediately (near-zero latency on repeat inputs)
2. If raw input is already well-formed (length > 8, no obvious abbreviation pattern), LLM call may still be warranted — always run step 3 on cache miss to ensure consistency
3. Call LLM (stage: `"destination_context"` → Gemini 2.5 Flash — cheap, fast):
   - System prompt: `prompts/destination-normalization.md`
   - User prompt: just the raw input string
   - Max tokens: 50 (canonical name is short — never more than a few words)
4. Strip whitespace, validate response is non-empty
5. `cacheWrite(raw, "canonical_name", canonical, TTL.CANONICAL)` — permanent cache (canonical names never change)
6. Return canonical string
7. On any failure: log warning, return `raw` as-is (pipeline continues with raw input)

---

## Cache design

```
cache/destinations/{raw-input-slug}/canonical_name.json
```

Examples:
- `cache/destinations/zion/canonical_name.json` → `"Zion National Park"`
- `cache/destinations/zion-np/canonical_name.json` → `"Zion National Park"`
- `cache/destinations/nyc/canonical_name.json` → `"New York City"`

The canonical name is then slugged to the real destination directory:
- `"Zion National Park"` → `zion-national-park` → hits `cache/destinations/zion-national-park/`

The raw-input cache dir (`zion/`) only ever contains `canonical_name.json`. All real pipeline data lives under the canonical slug (`zion-national-park/`).

**TTL:** Permanent (`-1`) — canonical names never change.

---

## Prompt (`prompts/destination-normalization.md`)

The prompt must:
- Return only the canonical name — no explanation, no punctuation
- Handle abbreviations (NP, NYC, LA), misspellings, shorthand, city nicknames
- Resolve sub-locations to their parent destination
- Default to most globally recognizable version for ambiguous names
- Never return an empty string

---

## LLM routing

Stage: `"destination_normalization"` → routes to Gemini 2.5 Flash (cheap stage).
Max tokens: 1024 — visible output is ~10 tokens (a destination name), but Gemini 2.5 Flash
uses internal thinking tokens before producing visible output, consuming from the max_tokens
budget. 1024 gives sufficient thinking headroom while keeping cost near-zero.

This requires adding `"destination_normalization"` to the `Stage` type.

---

## Failure handling

Non-fatal. On any LLM error, network error, or empty response: log a warning and return the raw input string. The pipeline continues with the raw string as `dest` — cache will miss on first run, but the request succeeds.

---

## Wiring into generate route

```typescript
// app/api/generate/route.ts — first line of pipeline
const dest = await normalizeDestination(destination.trim(), provider)
// All downstream calls use `dest` instead of `destination.trim()`
```

The raw input is preserved in logs for debugging but not used anywhere else.

---

## Unit tests

| Test | Covers success criterion |
|---|---|
| "Zion" → "Zion National Park" | Abbreviation / shorthand resolution |
| "Zion National Park" → "Zion National Park" | Well-formed input passes through unchanged |
| Cache hit on second call with same raw input — no LLM call | Cache convergence |
| "Zion" and "Zion NP" both resolve to same canonical slug | Cross-variation cache convergence |
| LLM failure → returns raw input, no throw | Non-fatal fallback |
| "The Narrows" → "Zion National Park" | Sub-location resolved to parent destination |

---

## Open technical items

- Max tokens set to 50 — if a canonical name is somehow longer (e.g. a very long national park name in another country), response will be truncated. Monitor in production. (2026-05-28)
- No confidence score from the LLM — if input is totally unrecognizable ("asdfgh"), it will return something plausible but wrong. No guard against hallucinated destination names. (2026-05-28)
- The `plan/route.ts` route also takes a raw destination indirectly (via the board object which already has the canonical name stored). No normalization needed there. (2026-05-28)
