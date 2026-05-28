# Theme: Hiking & Outdoors

## Purpose
Surface trails, outdoor routes, and multi-hour physical experiences in natural settings. This theme is for people who want to move through the landscape on foot (or bike).

## What belongs here
- Trails of all difficulties — easy walks, moderate day hikes, strenuous summit attempts
- Multi-day treks or backpacking routes (with note on permits and planning required)
- Bike routes and cycling experiences in natural settings
- Waterfall hikes, coastal walks, canyon routes, summit climbs
- Permit-required wilderness experiences

## What does NOT belong here
- Urban walking tours or city neighborhood walks (those go in culture or unique_local)
- Short flat strolls to a viewpoint (if the stroll is incidental, it belongs in nature)
- Activities where hiking is the means but the experience is something else (e.g., a guided bird-watching hike belongs in nature)

## Coverage tiers — you MUST include at least one card from each applicable tier

**Tier 1 — Accessible** (paved or flat, ≤1 mile round-trip, zero significant elevation, stroller/wheelchair compatible)
Examples: boardwalk loops, paved riverside paths, visitor center nature walks
Party type applicability: ALL — especially required for `family_young` and `older_parents`

**Tier 2 — Short & Easy** (1–3 miles round-trip, minimal elevation gain <300 ft, ≤2 hours)
Examples: waterfall approach trails, short canyon walks, easy ridge walks
Party type applicability: ALL

**Tier 3 — Half-Day Moderate** (4–7 miles round-trip, 500–1500 ft elevation, 3–5 hours)
Examples: most classic day hikes, crater rims, canyon descents
Party type applicability: `family_teens`, `couple`, `solo` — NOT `family_young` or `older_parents`

**Tier 4 — Full-Day Strenuous** (8+ miles, 1500+ ft elevation, 6+ hours, or technical terrain)
Examples: summit climbs, backcountry loops, ridge traverses
Party type applicability: `couple`, `solo` — NOT families or older_parents

**Party type rules:**
- `family_young`: include ONLY Tier 1 and Tier 2. Do not generate Tier 3 or Tier 4 cards.
- `older_parents`: include ONLY Tier 1 and Tier 2.
- All others: include at least one card per tier if the destination has examples at that level.

**Required self-check:** Before returning, verify: is there at least one Tier 1 (paved/accessible) trail card? If not, add one. Every destination with trails has at least one accessible option — if you can't name it specifically, use "accessible trail near [visitor center / main entrance]" as the location_hint and note the uncertainty in `watch_out_for`.

## Card guidance
- `effort` must reflect the tier accurately — use distance, elevation gain, and trail condition, not subjective feel
- `best_time` must address both time of day AND seasonality — many trails are impassable or inadvisable in certain conditions
- `long_description` must include approximate distance and elevation gain
- `local_tip` should include trailhead access, parking, permit requirements, or the one piece of trail knowledge that changes the experience
- `what_to_bring` is essential — water, layers, sun protection, footwear
- `watch_out_for` should address real hazards: heat, exposure, trail condition, wildlife, navigation
- `booking_difficulty` must reflect permit requirements accurately — some trails require permits months in advance
- `duration` should include realistic round-trip time including stops, not the trail marketing number
