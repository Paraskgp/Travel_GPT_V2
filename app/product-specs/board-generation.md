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
- A board-candidate curation audit: the full verified pool is preserved, while entries not suitable for board cards are flagged with exclusion reasons for human review
- Each card: id, name, short/long description, tags, why_worth_it, duration, effort, cost_band, booking_difficulty, best_time, local_tip, who_for, location_hint, is_mappable, personalization_note, and more
- Board-level `geographic_clusters`: every experience assigned to a 15–20 minute walkable/logical cluster, plus cluster-to-cluster travel estimates used by itinerary planning and nearby-experience UI

## Theme registry (11 themes)

| ID | Display name | Notes |
|---|---|---|
| `signature` | Signature Experiences | Always anchor — runs first |
| `unique_local` | Unique & Local | Includes destination-specific workshops |
| `food` | Food & Drink | Merged from food_drink + food_crawls |
| `culture` | Culture & History | Museums, heritage, ceremonies |
| `arts` | Arts & Workshops | Contemporary art, general craft workshops |
| `outdoor` | Scenic, Nature & Hiking | Merged from nature + hiking; effort on card |
| `adventure` | Adventure & Adrenaline | Adrenaline activities; separate from outdoor |
| `shopping` | Shopping & Markets | Retail intent |
| `nightlife` | Nightlife | After-dark |
| `day_trips` | Day Trips | Leaving the city |
| `seasonal` | Seasonal & Time-Bound | Events, festivals, phenomena |

**Removed themes (now card attributes):**
- `rainy_day` → `weather_sensitivity` field on cards
- `family` → `suitability_tags: family_friendly` on cards
- `romantic` → `suitability_tags: romantic` on cards

## Two-wave generation

**Wave 1 — Signature theme alone:**
The Signature theme runs first and owns the destination's most iconic experiences. This prevents the most famous experiences from being duplicated across multiple themes.

**Wave 2 — All other themes in parallel:**
All remaining applicable themes run simultaneously. Each receives the Signature theme's blocklist (experience names already used) to prevent cross-theme duplication.

## Candidate curation before theme generation

The verified experience pool can be intentionally large: major cities may produce hundreds of named entities from search, including true attractions, restaurants, sub-areas, stations, passes, parking, tours, exhibitions, and facilities. Board generation must not pass this raw pool directly into every theme prompt.

Before theme generation, the pipeline performs a deterministic curation pass that:

- Preserves the full verified pool for audit and future human review
- Deduplicates exact normalized names for prompt input only
- Flags entries that should be excluded from final board-card consideration, rather than deleting them
- Marks likely child/detail entries whose information should enrich a parent card, not become a separate card
- Scores board-worthiness using generic signals: source count, fact density, must-cover match, theme fit, food/restaurant intent, and whether a traveler coming from another city or country would reasonably spend 1–3 hours including travel overhead
- Produces a compact ranked candidate set per theme, generally around 20–30 candidates unless the available qualified pool is smaller

## Pre-board candidate enrichment

Curation should not permanently discard a promising experience just because the broad search corpus found thin or generic context. After the first curation pass, the pipeline performs targeted enrichment for promising candidates and uncertain exclusions, then runs curation again on the enriched pool.

This enrichment is intentionally selective. It is not a deep-research pass over every raw entity in a large destination. It targets:

- Candidates already likely to enter a board prompt
- Must-cover or signature-like experiences whose facts are thin
- Experiences excluded only because of weak facts or no theme fit, not because they are infrastructure/services
- A limited food subset until the dedicated restaurant-by-cuisine-by-cluster pipeline exists

For each selected target, enrichment may add:

- Google Places metadata when available: rating, review count, website, business status, hours, coordinates, review snippets, editorial summary, and place type
- Targeted web-search facts from 1–2 destination-specific queries, including an official-site query and a reviews/visit-duration query
- Source URLs from targeted pages, appended to the candidate's existing source list

Enrichment is additive and auditable. It must not invent facts, delete the original extracted record, or use ratings as a naive ranking proxy. Ratings and review counts are confidence/popularity signals; final board-worthiness still depends on destination fit, uniqueness, trip-time worthiness, logistics, and theme fit. If enrichment fails, the pipeline keeps the original curation result and continues.

Restaurants and food remain first-class but are not forced through Signature-style scarcity. The food theme may receive a broader candidate inventory because cuisine, dietary restrictions, price, and geography require more downstream choice. This is a temporary bridge until the dedicated restaurant-by-cuisine-by-cluster pipeline exists.

Child/detail rule: a named sub-area or sub-attraction inside a larger destination experience should usually become context on the parent card, not its own card. Example pattern: areas inside a theme park, wings inside a museum, named rooms/gardens inside a larger estate, or access gates into a park. The child is retained in the audit as `fold_into_parent` so a reviewer can inspect the decision.

Board-worthiness filter: a candidate should be strong enough that a traveler visiting from another city or country might reasonably spend at least an hour of trip time on it, plus round-trip travel overhead. If not, it is flagged as excluded from board inclusion with a reason. This includes infrastructure, ticket/pass products, generic services, parking, transit utilities, and low-signal fragments.

## Experience ordering within themes

Experiences within each theme are ranked at generation time — not reordered later. The LLM produces them in ranked order; the pipeline preserves that order exactly.

**Ranking criteria (in priority order):**
1. Must-cover anchors from destination context come first — these are the experiences whose absence a senior editor would immediately notice
2. Uniqueness to this destination — can only be done here, or is far better here than anywhere else
3. Broadly accessible — reaches more traveler types without special fitness, budget, or timing requirements
4. Niche/conditional/specialist experiences last — valuable but not for everyone

Preference-based reordering (when traveler preferences are provided) adjusts within this order — it does not override it. The destination's inherent hierarchy is the baseline; preferences shift ranking within that.

## Success criteria

- Every applicable theme from destination context produces at least one theme in the board
- No experience appears in more than one theme (cross-theme deduplication enforced server-side)
- Every card has a `location_hint` that is a specific named place (not a neighborhood or region)
- Every card appears in exactly one board-level geographic cluster
- Geographic clusters are stable for a board and do not depend on party type, dates, forced/skipped IDs, or itinerary preferences
- `is_mappable: true` on any card where `location_hint` resolves to a Google Maps pin
- `local_tip` must be specific to this exact place — fails the "detach test" if it could appear in a guidebook to a different destination
- `best_time` is clock-specific for time-sensitive experiences (wildlife, light-dependent views, popular attractions)
- Board cards are grounded in verified or otherwise verifiable real experiences; the full verified list is preserved as source inventory, not forced onto the board
- Promising or uncertain candidates receive targeted enrichment before final board exclusion/ranking
- Entries excluded from board-card consideration are flagged with reasons, not silently discarded
- Child/detail entries are either promoted only when they are independently trip-worthy or folded into the parent candidate as context
- Output is valid JSON matching the `Board` schema

## Evaluation criteria

- **Required experience presence** — experiences in `golden.specs.board.required` must appear on the board
- **Forbidden experience absence** — experiences in `golden.specs.board.forbidden` must not appear (hallucination check)
- **Candidate curation quality** — excluded candidates are genuinely not board-worthy, and major parent experiences retain useful details from folded children
- **Pre-board enrichment quality** — thin but important candidates gain official/Google/search context before final ranking, while obvious infrastructure remains excluded without expensive research
- **Tier coverage** — each theme must include experiences across effort tiers (easy/moderate/strenuous) where the destination supports it
- **Tip specificity** — sampled `local_tip` fields scored against the detach test. Tips that could appear in any travel guide score 0.
- **Deduplication** — zero cross-theme experience duplicates

## Simplifying assumptions

- Board is party_type-agnostic — the same board serves all traveler types. Party type filtering happens at itinerary planning time.
- Board is generated per destination, not per travel dates (dates affect weather context only, not the board itself)
- Board-level geographic clustering is computed once and cached with the board. Nearby recommendations can use this same cluster data without invoking itinerary planning.
- Wave 2 themes run in parallel — no inter-theme coordination beyond the Signature blocklist
- Pre-board enrichment is capped for latency and API cost. It is a targeted quality layer, not a replacement for the broad experience extraction corpus.

## Open items

- Tiered coverage not yet validated across all themes — adventure/nature/romantic partially specced (P1 in PRODUCT_SPEC.md)
- No post-generation self-critique pass to catch hallucinations that slipped through the extractor (P4)
- Board prompt changes invalidate the cache — there is no mechanism to do incremental updates to individual themes
- Geographic clustering is still LLM-based and currently logs coverage problems rather than repairing them.
- Dedicated restaurant inventory by cuisine, dietary support, price band, and geographic cluster is not yet implemented; food board curation keeps a broader candidate set as an interim measure.
