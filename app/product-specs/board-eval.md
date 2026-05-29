# Module: Board Completeness Evaluation

## What it does

After a board is fully generated, enriched, and grounded, a senior-travel-editor persona runs a completeness audit on the finished board. The evaluator reads the full card list and answers one question: **what experiences does every serious guide to this destination cover that are completely absent from this board?**

The output is a plain list of gaps — named missing experiences with a one-sentence reason why each belongs. Gaps are stored on the board as `eval_gaps` and written to the cache alongside the board. No cards are modified. No regeneration is triggered in V1 — the gap list is a quality signal for future improvement (editorial review, targeted regeneration, or UI surface).

This is the feedback loop the pipeline was missing. Every other quality system has someone check the output against a known standard. This module is that check.

## Inputs

- The fully generated board (all themes and cards, post-enrichment and grounding)
- Destination name

## Outputs

`eval_gaps: string[]` — a list of named missing experiences, each formatted as:
`"[Experience name] — [one sentence: why it belongs at this destination]"`

Empty array when no gaps are found. Never null.

Examples:
- `"Mount Fuji Day Trip — the single most iconic day trip from Tokyo, accessible by highway bus in 2 hours, absent from the Day Trips theme"`
- `"Aki Basho Sumo Tournament — September tournament at Ryogoku Kokugikan, the only place to see professional sumo in the world, overlaps with most September Tokyo trips"`
- `"Gondola ride, Venice — so central to the Venice experience that its absence on a Venice board would be immediately noticed by any editor"`

## Success criteria

- Runs for every new board, after enrichment and grounding, before cache write
- Never blocks board delivery — if the eval call fails, `eval_gaps` is set to `[]` and the board is cached normally
- Gaps are specific named experiences, not vague category observations ("there's no food content" is not a valid gap — "Tsukiji Fish Market outer market stalls" is)
- Gaps are only for things that are truly absent — not for things covered under a different name or in a different theme
- The eval call is capped at one LLM call per board generation — no retries, no multi-pass

## Evaluation criteria

- Precision: are the flagged gaps genuine omissions (not things that are already on the board under a different name)?
- Recall: does the evaluator catch what a human editor would immediately notice?
- False positive rate: how often does the evaluator flag something already present on the board?
- Actionability: are the gaps specific enough to act on (regenerate a theme, add a specific card)?

## Simplifying assumptions

- V1: gaps are stored and logged only. No automatic regeneration.
- The evaluator has no access to the `must_cover` list from destination context — it works from its own editorial knowledge. (Both signals are independent; together they catch different things.)
- One LLM call, no streaming, no retry on failure.
- The eval uses the same provider as board generation.

## Open items

- **Triggered regeneration (V2):** When `eval_gaps` is non-empty, trigger targeted regeneration for the affected themes. Add a second pass that generates cards specifically for the gap experiences and merges them into the board before caching. (2026-05-29)
- **Gap deduplication against board:** Evaluate whether the LLM is flagging things already on the board under a slightly different name. A future improvement would do a fuzzy name match before including a gap in the final list. (2026-05-29)
- **Gap severity scoring:** Some gaps are P0 (Mount Fuji missing from Tokyo), others are P2 (no sake brewery tour). A future pass could score gaps by how essential they are so the UI or regeneration trigger can prioritize. (2026-05-29)
