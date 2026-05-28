# Implementation Plan: Query Generation

## Owns

`lib/pipeline/experiences.ts` → `generateQueries(dest, themes, provider)`

## Inputs / Outputs

```typescript
generateQueries(
  dest: string,       // e.g. "Zion National Park"
  themes: string[],   // applicable theme IDs from DestinationContext
  provider: Provider = "openai"
): Promise<string[]>
// Returns array of search query strings
// Falls back to line-by-line parsing if LLM returns prose instead of JSON
```

## Steps

1. `callLLM(queryGeneratorSystemPrompt(), queryGeneratorUserPrompt(dest, themes), provider, "query_generator")`
   - Routes to Gemini 2.5 Flash automatically
   - User prompt specifies: `N_themes × 3` theme queries + 5 cross-cutting queries
2. `parseJSON<string[]>(raw)` — parse JSON array
3. Fallback: if JSON parse fails, split by newline and strip list prefixes (`1.`, `-`, `*`)
4. Return query array

## Prompt design

System prompt (`prompts/query-generator.md`) instructs:
- 3 queries per theme: broad + depth + corner case
- 5 fixed cross-cutting queries: iconic experience, official data, gateway town food, logistics, recent tips
- Queries under 12 words, no duplicate intent

User prompt (`queryGeneratorUserPrompt`) passes:
- Destination name
- Theme list with count
- Expected total query count: `(N_themes × 3) + 5`

## Caching

None. Queries are ephemeral — they are generated fresh each time experiences need to be generated. The experiences themselves are cached, so this function is only called on a cache miss.

## Failure handling

Throws on LLM failure — bubbles up to `getExperiences()` which catches and returns `[]`.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Output contains at least `N_themes × 3` queries for a given theme list | Minimum query count per theme |
| Food query contains the gateway town name (not just destination) | Gateway town in food query |
| At least one query targets a government/NPS source | Official source coverage |
| No two queries in the output are semantically identical | No duplicate intent |
| Fallback parser handles LLM prose output without truncating to 8 | Fallback correctness (no hard cap) |

## Open technical items

- No validation that each theme is represented by at least one query in the output — LLM could skip a theme
- Fallback line parser was previously capped at 8 queries — removed in session 2 (the cap silently discarded valid queries)
- No retry if query count is below expected minimum
