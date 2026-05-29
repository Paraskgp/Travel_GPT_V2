# Module: Places Enrichment

## What it does

Attaches comprehensive real-world metadata from Google Places (v1 API) to each mappable experience card. Enrichment is purely additive — it never modifies card content, only attaches structured data sourced from Google.

This runs in two sub-steps, both after the board is fully generated and tip-enhanced, before the board is cached:

1. **Enrichment** — fetches the full Google Places record for each mappable card and stores it verbatim on `places_enrichment`. No interpretation, no filtering — the complete API response is stored alongside the fields the UI needs today.
2. **Grounding** — propagates Google's own authoritative status signals (business_status, etc.) to a top-level `grounding_status` field on the card. No rules engine, no heuristics — direct pass-through of what Google says.

## Inputs

- Experience name
- Location hint (specific named place — used as primary search query)
- Destination name (disambiguation fallback)

## Outputs

Per enriched card, a `places_enrichment` object containing every field returned by the Google Places v1 API, plus a `raw` field holding the complete unprocessed API response for forward-compatibility.

UI-ready fields (subset of the above):
- `place_id` — Google Places ID
- `name` — matched place name from Google
- `rating` — e.g. 4.7
- `review_count` — e.g. 1,243
- `photo_url` — proxied through `/api/places-photo`
- `address` — formatted address
- `coordinates` — lat/lng
- `maps_url` — Google Maps URI
- `price_level` — 0 (free) to 4 ($$$$)
- `website` — official website URL (stored for future use; see Open Items)

Operational signals:
- `business_status` — `OPERATIONAL` | `CLOSED_TEMPORARILY` | `CLOSED_PERMANENTLY` (Google's own field, stored as-is)
- `opening_hours` — structured open/close periods by day
- `types` — Google's place type array e.g. `["museum","point_of_interest"]`
- `primary_type` — single cleaner category string

Family/experience attributes (all sourced directly from Google booleans, no inference):
- `good_for_children`, `good_for_groups`, `reservable`
- `serves_vegetarian_food`, `serves_beer`, `serves_wine`, `serves_cocktails`, `serves_coffee`
- `serves_breakfast`, `serves_lunch`, `serves_dinner`, `serves_brunch`, `serves_dessert`
- `live_music`, `outdoor_seating`, `delivery`, `dine_in`, `takeout`
- `payment_options`, `parking_options`, `accessibility_options`

At the card level, after enrichment:
- `grounding_status` — direct copy of `places_enrichment.business_status`, normalized to lowercase. `null` if no enrichment.

Cards with `is_mappable: false` receive `null` enrichment and `null` grounding_status.

## Success criteria

- All `is_mappable: true` cards have an enrichment attempt against the Google Places v1 API
- The complete raw API response is stored on `places_enrichment.raw` — no fields discarded at fetch time
- `photo_url` is proxied through `/api/places-photo` — raw Google resource name never sent to client
- `grounding_status` on every enriched card reflects Google's `businessStatus` field, unchanged
- Non-fatal: if Places lookup fails for any card, `places_enrichment` and `grounding_status` remain `null` and the board is unaffected
- API key is never exposed to the client — all calls are server-side only

## Evaluation criteria

- Match rate: percentage of `is_mappable: true` cards that return a valid enrichment
- Correct match rate: of matched cards, are they the right physical place?
- Closed venue detection: all `CLOSED_PERMANENTLY` cards have `grounding_status: "closed_permanently"`
- Photo availability: percentage of matched cards with a usable photo URL
- Boolean field coverage: percentage of enriched cards where at least one of the family/experience attributes is non-null

## Simplifying assumptions

- One Text Search + one Place Details call per mappable card (two API calls total)
- First result from Text Search is accepted as the match — no disambiguation UI
- `location_hint` is the primary search query when it differs from `name`; falls back to `name + destination`
- All API calls are server-side; enrichment silently skips if `GOOGLE_PLACES_API_KEY` is absent

## Open items

- **Website scraping (future):** `website` is now stored on every enriched card. A future pipeline step should fetch and parse the official website to validate card claims (operating status, pricing, booking requirements, menu content). This is a separate module — do not add scraping logic to the enrichment client.
- **Geographic bounding box:** Text Search accepts the first result with no location constraint. A future improvement would pass `locationBias` or `locationRestriction` to the Places v1 Text Search to reduce cross-city false positives.
- **Per-card enrichment cache:** enrichment currently re-runs on every fresh board generation. A future improvement would cache individual Place Details responses by `place_id` with a short TTL (7 days) so stable venues (major temples, museums) are not re-fetched on every board regeneration.
- **Photo count:** currently only the first photo is used. The API returns up to 10 photo references. Future UI may want a gallery.
- **Reviews:** up to 5 reviews are available from the API and are stored in `raw`. A future module could use review text to corroborate or contradict LLM card claims.
