# Implementation Plan: Weather Context

## Owns

`lib/pipeline/weather-context.ts` → `getWeatherContext(dest, monthLabel, monthSlug, provider)`

## Inputs / Outputs

```typescript
getWeatherContext(
  dest: string,          // e.g. "Zion National Park"
  monthLabel: string,    // e.g. "November 2026" — passed to LLM prompt
  monthSlug: string,     // e.g. "november" — used as cache key
  provider: Provider = "openai"
): Promise<WeatherContext | null>
// Returns null on failure — non-fatal
```

```typescript
interface WeatherContext {
  destination: string
  travel_month: string | null
  annual_summary: string
  months: Record<string, WeatherMonth>  // all 12 months
  travel_implications: string[]
}
```

## Steps

1. `cacheRead(dest, "weather_november")` — return cached if present
2. `callLLM(weatherContextSystemPrompt(), weatherContextUserPrompt(dest, monthLabel), provider, "weather_context")`
   - Routes to Gemini 2.5 Flash automatically via stage hint
3. `parseJSON<WeatherContext>(raw)`
4. `cacheWrite(dest, key, ctx, TTL.WEATHER)` — permanent (TTL = -1)
5. Return `ctx`

## Caching

- Key: `weather_{monthSlug}` — e.g. `weather_november`
- TTL: -1 (permanent — climate averages never change)
- Invalidation: never
- File: `cache/destinations/{slug}/weather_november.json`

Note: one cache entry per month per destination. A destination visited in both November and April has two separate weather cache files.

## Failure handling

Returns `null` on any failure. The pipeline continues without weather context. Board generation and itinerary planning degrade gracefully without it — they simply lack the seasonal context.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Cache hit returns stored data | Cache correctness |
| Cache miss generates, writes, returns | Full flow |
| Returns null on LLM error (non-fatal) | Non-fatal failure handling |
| Output has all 12 months present | Complete monthly data |
| `travel_implications` contains month-specific content when `monthLabel` is provided | Month-specific implications |

## Open technical items

- `monthSlug` is derived from the first word of `monthLabel` — "November 2026" → "november". This is fragile if month labels change format.
- No validation that all 12 months are present in the LLM output before caching
