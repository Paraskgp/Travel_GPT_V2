# Module: Itinerary Planning

## What it does

Builds a day-by-day schedule from the board. Takes the universal board (all experiences) and a specific traveler's context (dates, arrival/departure times, stay area, preferences, forced/skipped experiences) and produces a geographically coherent, realistically paced itinerary.

This is where the board becomes personal. Party type, dietary preferences, pace, and budget are applied here — not during board generation.

## Inputs

- Full board (all themes and experiences)
- Start and end dates
- Arrival time (when the traveler can start on day 1)
- Departure time (hard cutoff on last day)
- Stay area (where the traveler is sleeping — geographic anchor for routing)
- Preferences (party_type, dietary, interests, pace, budget)
- Forced experience IDs (must include)
- Skipped experience IDs (must exclude)

## Outputs

A day-by-day itinerary with:
- Each day: date, day number, day title, and a list of rows
- Each row: type (activity/travel/meal), start/end time, title, notes, planning_note, maps_url, experience_id

## Four-stage pipeline

**Stage 1 — Geographic clustering:**
LLM estimates pairwise travel times between all experiences and groups those within ~15 minutes walking distance into named clusters. Enables day planning around geographic zones.

**Stage 2 — Draft itinerary (Pass 1):**
Builds the full day-by-day schedule. Picks 1–2 clusters per day. Honours `best_time` anchors (sunrise spots, tide-dependent activities). Generates `planning_note` on every row explaining why each activity is scheduled when it is.

**Stage 3 — Review and refine (Pass 2):**
Runs 7 checks against the draft: party type violations, timing errors, activity density, geographic conflicts, departure day discipline, planning note quality, and forced/skipped compliance. Fixes violations and logs `change_log[]`.

## Success criteria

- Activity count per day matches pace preference (relaxed: 2–3, moderate: 3–4, packed: 4–5)
- No activities scheduled after departure time on final day
- `family_young` itineraries never include strenuous experiences without an accessible alternative on the same day
- Forced experiences appear in the itinerary; skipped experiences do not
- `planning_note` on every row explains scheduling reasoning — not a description of the activity
- Travel rows exist between geographically distant consecutive activities
- Shuttle rows present for destinations requiring shuttle access (e.g. Zion Canyon)

## Evaluation criteria

- **Deterministic checks (65% weight):** activity count per day, timing violations (activity after departure), forced/forbidden compliance, shuttle rows present, departure day discipline
- **Quality checks (35% weight):** planning note specificity (not generic descriptions), day flow narrative coherence, geographic clustering quality

## Simplifying assumptions

- Stay area is a single fixed location for the entire trip (no multi-base trips)
- Travel time estimates from the clustering LLM are approximate — not from a real routing API
- Meal rows are generated as part of the itinerary but not tied to specific restaurant cards from the board
- Pass 2 review is non-fatal — if it fails, Pass 1 draft is returned with a note in `change_log`

## Open items

- No real routing API (Google Maps Directions, Mapbox) — travel times are LLM estimates
- No constraint pre-pass before Pass 1 to extract time-locked anchors (P5 in PRODUCT_SPEC.md — score ceiling at ~62)
- Multi-destination trips (Grand Canyon + Page, AZ + Sedona) not supported — single destination only
- Recovery time between strenuous activities not modelled (identified in eval run 1)
