# Implementation Plan: Board Completeness Evaluation

## Owns

`lib/pipeline/board-eval.ts` → `evaluateBoard(board, provider)`
`prompts/board-eval.md` → evaluator system prompt
`lib/claude/prompts.ts` → `boardEvalSystemPrompt()`, `boardEvalUserPrompt(board)`

## Inputs / Outputs

```typescript
evaluateBoard(
  board: { destination: string; themes: Theme[] },
  provider: Provider
): Promise<string[]>
// Returns a list of gap strings, e.g.:
//   ["Mount Fuji Day Trip — ...", "Sumo at Ryogoku Kokugikan — ..."]
// Returns [] on any error — never throws, never blocks board delivery.
```

Board type gains:
```typescript
eval_gaps: string[]   // populated after eval pass; empty array if eval skipped or finds nothing
```

## Steps

### In `generateBoard` (after grounding pass, before cache write):

```typescript
// ── Board completeness eval ──────────────────────────────────────────────────
const gaps = await evaluateBoard({ destination: dest, themes: enhancedThemes }, provider)
if (gaps.length > 0) {
  console.log(`[pipeline/board] eval gaps (${gaps.length}):`)
  gaps.forEach(g => console.log(`  - ${g}`))
}
// Attach to each theme object (stored in cache for future UI use)
const finalThemes = enhancedThemes  // gaps stored at Board level, not Theme level
```

Gaps are stored on `Board.eval_gaps`. The board cache write includes `eval_gaps` alongside `themes`.

### `evaluateBoard` implementation:

1. Build a flat card list from all themes (name + theme name only — no full cards to keep prompt compact)
2. Call LLM with `boardEvalSystemPrompt()` and `boardEvalUserPrompt(destination, cardList)`
3. Parse response as `string[]`
4. Return array; return `[]` on any error

## Prompt design (`prompts/board-eval.md`)

The evaluator receives:
- Destination name
- Flat list of all card names grouped by theme

The evaluator is prompted to act as a senior travel editor who has spent years covering this destination. The prompt asks one question: "What clearly belongs at this destination that is completely absent from this board?"

Rules injected into the prompt:
- Flag only things that are truly absent — not things covered under a different name in another theme
- Each gap must be a specific named experience, not a category ("no nightlife" is invalid; "Robot Restaurant" or "Golden Gai bar hopping" would be valid)
- Maximum 8 gaps per board — if everything essential is covered, return `[]`
- Return ONLY a JSON array of strings

## Caching

No separate cache. Board cache write includes `eval_gaps`. Re-runs on every board regeneration (not cached independently). This is intentional — gaps should reflect the current board, not a stale eval from a previous generation.

## Failure handling

Non-fatal. `evaluateBoard` catches all errors and returns `[]`. Board delivery is never blocked. A failed eval means `eval_gaps: []` — same as a clean board. The board pipeline continues normally.

## Unit tests

| Test | Covers criterion |
|---|---|
| Returns `[]` on LLM error | Non-fatal |
| Returns `[]` when board is complete | No false alarms |
| Returns named gaps for clearly incomplete board | Recall |
| Does not flag things already on the board | Precision |
| Board cache includes `eval_gaps` field | Storage |
| Gaps are strings (not objects) | Output format |

## Open technical items

- **Fuzzy deduplication:** before returning a gap, check if the gap name fuzzy-matches any existing card name to avoid false positives. Simple Levenshtein or substring check. (2026-05-29)
- **V2 triggered regeneration:** if gaps non-empty, run a targeted theme call for the gap experiences and merge cards before cache write. Requires identifying which theme each gap belongs to. (2026-05-29)
