# Module: Destination Context

## What it does

Generates a structured understanding of a destination's identity — its soul, defining pillars, honest caveats, applicable experience themes, and best area to stay. This is the foundation that every downstream module builds on. Without it, board generation produces generic cards that could describe any city; with it, cards feel specific to this place.

## Inputs

- Destination name (e.g. "Zion National Park", "Kyoto", "Amalfi Coast")

## Outputs

- **Soul** — 2–3 paragraphs capturing what makes this place itself
- **Defining pillars** — 4–6 short phrases: the essential things that define the destination
- **Best for** — types of travelers this destination suits most
- **Honest notes** — real caveats: crowds, permit requirements, access constraints, seasonal dangers
- **Applicable themes** — which of the 16 experience themes genuinely apply here (e.g. Zion gets `hiking` and `adventure`; it does not get `nightlife` or `shopping`)
- **Recommended stay area** — the best base area/neighborhood/lodge, with a one-sentence reason

## Success criteria

- Applicable themes list must exclude themes that don't genuinely apply to the destination (no `nightlife` for Zion, no `hiking` for a city beach resort)
- Soul text must be specific to this destination — must not read as interchangeable with a similar destination
- Recommended stay area must be a real, named place (not "near the park" or "central area")
- Honest notes must include at least one real friction point (crowds, permits, access, season)
- Output is valid JSON matching the `DestinationContext` type

## Evaluation criteria

- Theme precision: fewer false positives (themes listed that don't apply) is better than false negatives (themes missing that do apply)
- Soul specificity: would this soul paragraph make sense applied to a different destination? If yes, it is too generic.
- Honest notes quality: do the notes tell you something you wouldn't already assume?

## Simplifying assumptions

- Generated from LLM training knowledge only — no live data sources
- Destination name is trusted as provided; no disambiguation (e.g. "Paris" = Paris, France)
- One recommended stay area per destination (multi-base trips not modelled here)

## Open items

- Regional complements field not yet implemented — "Grand Canyon" should surface Page, AZ and Sedona as context for the itinerary planner (P3 in PRODUCT_SPEC.md)
- No refresh signal — if a destination changes (new access road, park closure), the 180-day cache means stale context persists
