# Module: Board Generation

## What it does

Generates the full set of themed experience cards for a destination. Each card is a rich, opinionated description of one experience: what it is, why it matters here, when to go, the local intelligence most visitors miss, and practical logistics. The board is universal — it represents all worthwhile experiences at the destination regardless of who is traveling.

## Inputs

- Destination name
- Destination context (soul, pillars, applicable themes, stay area)
- Weather context (climate data for the travel month)
- Verified experiences list (from experience extraction — the hallucination firewall)
- Preferences (dietary, interests, pace, budget — NOT party_type, which is stripped)

## Outputs

- A list of themes, each containing 5–10 experience cards
- Each card: id, name, short/long description, tags, why_worth_it, duration, effort, cost_band, booking_difficulty, best_time, local_tip, who_for, location_hint, is_mappable, personalization_note, and more

## Two-wave generation

**Wave 1 — Signature theme alone:**
The Signature theme runs first and owns the destination's most iconic experiences. This prevents the most famous experiences from being duplicated across multiple themes.

**Wave 2 — All other themes in parallel:**
All remaining applicable themes run simultaneously. Each receives the Signature theme's blocklist (experience names already used) to prevent cross-theme duplication.

## Success criteria

- Every applicable theme from destination context produces at least one theme in the board
- No experience appears in more than one theme (cross-theme deduplication enforced server-side)
- Every card has a `location_hint` that is a specific named place (not a neighborhood or region)
- `is_mappable: true` on any card where `location_hint` resolves to a Google Maps pin
- `local_tip` must be specific to this exact place — fails the "detach test" if it could appear in a guidebook to a different destination
- `best_time` is clock-specific for time-sensitive experiences (wildlife, light-dependent views, popular attractions)
- All experiences in the verified list appear in the board (hallucination guard: board adds richness, not new place names)
- Output is valid JSON matching the `Board` schema

## Evaluation criteria

- **Required experience presence** — experiences in `golden.specs.board.required` must appear on the board
- **Forbidden experience absence** — experiences in `golden.specs.board.forbidden` must not appear (hallucination check)
- **Tier coverage** — each theme must include experiences across effort tiers (easy/moderate/strenuous) where the destination supports it
- **Tip specificity** — sampled `local_tip` fields scored against the detach test. Tips that could appear in any travel guide score 0.
- **Deduplication** — zero cross-theme experience duplicates

## Simplifying assumptions

- Board is party_type-agnostic — the same board serves all traveler types. Party type filtering happens at itinerary planning time.
- Board is generated per destination, not per travel dates (dates affect weather context only, not the board itself)
- Wave 2 themes run in parallel — no inter-theme coordination beyond the Signature blocklist

## Open items

- Tiered coverage not yet validated across all themes — adventure/nature/romantic partially specced (P1 in PRODUCT_SPEC.md)
- No post-generation self-critique pass to catch hallucinations that slipped through the extractor (P4)
- Board prompt changes invalidate the cache — there is no mechanism to do incremental updates to individual themes
