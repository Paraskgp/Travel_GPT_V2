# Implementation Plan: Tip Enhancement

## Owns

`lib/pipeline/board.ts` — tip enhancement pass inside `generateBoard()`
`lib/claude/prompts.ts` → `tipEnhancementSystemPrompt()`, `tipEnhancementUserPrompt()`

There is no standalone `getTipEnhancement()` function — this pass runs as a step within `generateBoard()` after theme generation and deduplication.

## Inputs / Outputs

```typescript
// Per experience, called inside generateBoard()
callLLM(
  tipEnhancementSystemPrompt(),
  tipEnhancementUserPrompt(
    exp.name,            // experience name
    exp.location_hint,   // specific named place
    dest,                // destination
    theme.name,          // theme context
    exp.local_tip        // current tip to rewrite
  ),
  provider,
  "tip_enhancement"     // → routes to Gemini 2.5 Flash
): Promise<string>      // returns the rewritten tip string
```

## Steps

Inside `generateBoard()`, after deduplication:

```typescript
enhancedThemes = await Promise.all(
  themes.map(async theme => {
    const enhancedExperiences = await Promise.all(
      theme.experiences.map(async exp => {
        try {
          const enhanced = await callLLM(tipSysPrompt, tipUserPrompt(...), provider, "tip_enhancement")
          return { ...exp, local_tip: enhanced.trim() || exp.local_tip }
        } catch {
          return exp  // keep original on failure
        }
      })
    )
    return { ...theme, experiences: enhancedExperiences }
  })
)
```

All tips across all themes run in parallel (nested `Promise.all`).

## Prompt design

System prompt (`tipEnhancementSystemPrompt()` — inlined in `prompts.ts`, not a .md file):
- Banned phrases list (arrive early, book in advance, bring binoculars, etc.)
- Detach test: tip must be impossible to transplant to another destination
- Must explain the WHY, not just the what or where

## Caching

None at this layer. Tip enhancement results are included in the board cache (`board_{promptHash}.json`). If the board cache hits, tip enhancement is skipped entirely.

## Failure handling

Per-experience try/catch. On failure: original `local_tip` is kept. Never blocks board delivery.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Rewritten tip does not contain any banned phrase | Banned phrase absence |
| On LLM failure, original tip is preserved | Non-fatal failure |
| Empty string response falls back to original tip | Empty response guard |
| All experiences across all themes are processed (not just first theme) | Coverage |

## Open technical items

- Tip enhancement system prompt is inlined in `prompts.ts` as a string, not in `prompts/` as a `.md` file. This means prompt changes do NOT invalidate the board cache. Should be moved to `prompts/tip-enhancement.md`. **This is a known gap.**
- No automated scoring of tip quality before caching — a bad rewrite is cached and served
- ~60 tips × 1 LLM call = 60 parallel Gemini calls. At scale this could hit rate limits.
