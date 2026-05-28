# Module: Places Enrichment

## What it does

Attaches real-world metadata from Google Places to each mappable experience card. Purely additive — enrichment never changes card content, only adds structured data that the UI uses for ratings, photos, and map pins.

This runs after the board is fully generated and tip-enhanced, before the board is cached.

## Inputs

- Experience name
- Location hint (specific named place — used as the search query)
- Destination name (used as disambiguation fallback)

## Outputs

Per enriched card, a `places_enrichment` object containing:
- `place_id` — Google Places ID
- `name` — matched place name from Google
- `rating` — e.g. 4.7
- `review_count` — e.g. 1,243
- `photo_url` — proxied through `/api/places-photo` (API key never exposed to client)
- `address` — formatted address
- `coordinates` — lat/lng
- `maps_url` — Google Maps link
- `price_level` — 0 (free) to 4 ($$$$)

Cards with `is_mappable: false` receive `null` enrichment.

## Success criteria

- All `is_mappable: true` cards have an enrichment attempt
- Photo URL is proxied through `/api/places-photo` — raw Google photo reference never sent to the client
- The photo proxy uses only `GOOGLE_PLACES_API_KEY` from the environment; if the key is missing, photo requests fail closed with a controlled service-unavailable response
- Non-fatal: if Places lookup fails for any card, that card's `places_enrichment` remains `null` and the board is unaffected
- `place_id` matches the correct location (not a similarly named place in a different city)

## Evaluation criteria

- Match rate: what percentage of `is_mappable: true` cards return a valid enrichment?
- Correct match rate: of those matched, are they the right place (not a false positive with a similar name)?
- Photo availability: what percentage of matched places have a usable photo?

## Simplifying assumptions

- One Places lookup per card (Text Search + Details) — two API calls per mappable experience
- First result from Text Search is accepted as the match — no disambiguation UI
- `location_hint` is used as the primary search query when it differs from the experience name; falls back to `name + destination`
- Enrichment and photo proxying run only when `GOOGLE_PLACES_API_KEY` is set in environment — enrichment is silently skipped otherwise, while direct photo proxy requests return a controlled error

## Open items

- No validation that the matched place is geographically near the destination — "Angels Landing" could theoretically match a business in another state
- No caching of Places enrichment — runs on every fresh board generation
- Price_level is an integer (0–4) with no currency context — may be misleading for international destinations
