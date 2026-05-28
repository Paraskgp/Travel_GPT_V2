# Implementation Plan: Destination Context

## Owns

`lib/pipeline/destination-context.ts` → `getDestinationContext(dest, provider)`

## Inputs / Outputs

```typescript
getDestinationContext(
  dest: string,          // e.g. "Zion National Park"
  provider: Provider = "openai"
): Promise<DestinationContext>
// Throws on failure — caller handles error
```

```typescript
interface DestinationContext {
  destination: string
  soul: string
  defining_pillars: string[]
  best_for: string[]
  honest_notes: string[]
  applicable_themes: string[]
  recommended_stay_area: string
  recommended_stay_reason: string
}
```

## Steps

1. `cacheRead(dest, "destination_context")` — return cached if present
2. `callLLM(destinationContextSystemPrompt(), destinationContextUserPrompt(dest), provider, "destination_context")`
   - Routes to Gemini 2.5 Flash automatically via stage hint
3. `parseJSON<DestinationContext>(raw)`
4. `cacheWrite(dest, "destination_context", ctx, TTL.DESTINATION_CONTEXT)` — 180 days
5. Return `ctx`

## Caching

- Key: `destination_context`
- TTL: 180 days
- Invalidation: TTL expiry only
- File: `cache/destinations/{slug}/destination_context.json`

## Failure handling

Throws on any failure. The generate route catches this and returns HTTP 500. Destination context is fatal — the pipeline cannot proceed without it (applicable_themes drives all downstream steps).

## Unit tests

| Test | Covers success criterion |
|---|---|
| Cache hit returns stored data without calling LLM | Cache correctness |
| Cache miss calls LLM, writes result, returns it | Full flow |
| Output contains all required fields with non-empty values | Valid DestinationContext shape |
| `applicable_themes` contains only valid theme IDs from the approved list | Theme precision |
| `recommended_stay_area` is non-empty and not a generic description | Stay area specificity |

## Open technical items

- No validation that `applicable_themes` values are from the approved theme list (trusted from LLM output)
- No retry on LLM failure
