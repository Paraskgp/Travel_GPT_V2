# Module: Tip Enhancement

## What it does

Rewrites the `local_tip` field on every experience card from a generic observation into a hyper-specific, actionable insight that is impossible to detach from this exact place. This runs as a post-processing pass after board generation, before the board is cached.

The gap this closes: board generation LLMs under token pressure produce tips like "arrive early to avoid crowds" — advice that could appear in any travel guide anywhere. Tip enhancement is a focused single-purpose rewrite that forces specificity.

## Inputs

- Experience name
- Location hint (the specific named place)
- Destination name
- Theme name (context for what kind of experience this is)
- Current tip (the generic tip from board generation to be rewritten)

## Outputs

- A single rewritten tip string — one sentence or short paragraph, specific to this exact place

## What a good tip looks like

Bad: "Arrive early to avoid crowds"
Good: "Pull over at the Picnic Area pullout on the Lamar Valley road by 6:30am — the Junction Butte wolf pack hunts in the meadow directly below and rangers often gather here with spotting scopes"

The test: could this tip appear verbatim in a guidebook to a different destination? If yes, rewrite it.

## Success criteria

- Output tip passes the detach test — impossible to transplant to a different destination without it becoming false or meaningless
- Banned phrases not present: "arrive early", "bring binoculars", "book in advance", "wear comfortable shoes", "check the weather", "visit in the morning", "can get crowded", "during peak season"
- Tip explains the WHY — not just where to go or what time, but why that spot or time is categorically better than the default
- If the current tip is already specific and good, returns it unchanged (does not degrade quality)

## Evaluation criteria

- Detach test pass rate: what percentage of tips could not plausibly appear in a different destination's guidebook?
- Banned phrase frequency: zero occurrences of banned phrases in final board
- Improvement rate: what percentage of rewritten tips are measurably more specific than the input?

## Simplifying assumptions

- One LLM call per experience — each tip is rewritten independently with no cross-card context
- Non-fatal: if a tip rewrite fails or returns empty, the original tip is kept
- Runs in parallel across all cards — no ordering dependency

## Open items

- No automated scoring of tip quality before caching — a bad rewrite is cached and served
- No golden set of tip examples per destination to guide the rewriter
