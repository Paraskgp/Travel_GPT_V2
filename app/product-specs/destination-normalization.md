# Module: Destination Normalization

**Last updated:** 2026-05-28

---

## What it does

Resolves any raw user-typed destination string into a canonical, fully-qualified destination name before it touches any part of the pipeline.

Without this module, every variation of a destination name generates a separate cache entry and a full pipeline re-run:
- "Zion" → miss
- "Zion NP" → miss
- "Xayan" (misspelling) → miss
- "zion national park" (lowercase) → hit (slug handles case)
- "Zion National Park, Utah" → miss

With this module, all of the above resolve to "Zion National Park" before the first cache lookup, so the board, experiences, and destination context cached under that canonical name are always reused.

This module is the first thing the generate route calls — before destination context, weather, experiences, or board. Everything downstream uses the canonical name as its `dest` string.

---

## Inputs

- Raw destination string as typed by the user — anything from a full park name to a city abbreviation to a misspelling

---

## Outputs

- A canonical destination name string: specific, properly capitalised, and unambiguous
  - "Zion" → "Zion National Park"
  - "NYC" → "New York City"
  - "Kyoto JP" → "Kyoto, Japan"
  - "Xayan" → "Zion National Park" (best-effort correction for close misspellings)
  - "paris" → "Paris, France"
  - "The Narrows" → "Zion National Park" (sub-location resolved to its parent destination)

---

## Success criteria

- A user typing "Zion" hits the same cache as "Zion National Park" — no duplicate pipeline runs
- A misspelling close enough to a real destination resolves to the correct canonical name
- A fully-qualified name passed in ("Zion National Park") passes through unchanged
- Normalization adds no perceptible latency on repeat inputs (cache hit is near-instant)
- On LLM failure or ambiguous input, falls through to raw input — pipeline continues, no hard failure

---

## Evaluation criteria

- **Cache convergence rate** — what % of common input variations for a known destination (e.g. "Zion", "ZNP", "Zion NP", "Zion Utah") resolve to the same canonical slug
- **Correction accuracy** — for intentional misspellings (e.g. "Yosemmite", "Santoreni"), does it return the correct canonical name vs. a plausible but wrong name

---

## Simplifying assumptions

- One canonical name per destination — no disambiguation between "Springfield, Illinois" vs "Springfield, Missouri" unless the user provides enough context to distinguish
- Sub-location inputs ("The Narrows", "Angel's Landing") are resolved to the parent destination — the pipeline operates at destination level, not sub-attraction level
- The LLM is trusted to identify the most likely destination for ambiguous short inputs ("Zion" = Zion National Park, not Zion, Illinois)
- No user confirmation step for corrections — the resolved name is used silently. If wrong, the user will see the wrong destination's board and re-submit

---

## Open items

- No user-facing "Did you mean X?" confirmation when a correction is applied — the resolved name is used silently. This could mislead users if correction is wrong. Consider surfacing the canonical name in the UI response so users can catch errors. (2026-05-28)
- Ambiguous city names ("Springfield", "Portland") default to the most globally recognizable version — no disambiguation prompt. (2026-05-28)
