# Implementation Plan: Places Enrichment

## Owns

`lib/places/client.ts` → `enrichExperience(name, locationHint, destination)`
`app/api/enrich/route.ts` → client-triggered enrichment endpoint
`app/api/places-photo/route.ts` → photo proxy (keeps API key server-side)

Enrichment runs in two places:
1. **Server-side** inside `generateBoard()` — for all `is_mappable` cards, on fresh board generation
2. **Client-side** via `POST /api/enrich` — for on-demand enrichment from the UI

## Inputs / Outputs

```typescript
enrichExperience(
  name: string,           // experience name — used as fallback query
  locationHint: string,   // specific place name — primary search query
  destination: string     // used in fallback query: "name + destination"
): Promise<PlacesEnrichment | null>
// Returns null if GOOGLE_PLACES_API_KEY not set, or if lookup fails
```

```typescript
interface PlacesEnrichment {
  place_id: string
  name: string
  rating: number | null
  review_count: number | null
  photo_url: string | null      // always proxied: /api/places-photo?ref=...
  address: string | null
  coordinates: { lat: number; lng: number } | null
  maps_url: string | null
  price_level: number | null
}
```

## Steps

1. If `!GOOGLE_PLACES_API_KEY` → return `null` (skipped, not an error)
2. **Text Search:** `GET /maps/googleapis.com/maps/api/place/textsearch/json?query={query}&key={key}`
   - Query = `locationHint` if different from `name`, else `name + destination`
   - Take first result: `place_id`, `name`, `rating`, `user_ratings_total`
3. **Place Details:** `GET /maps/googleapis.com/maps/api/place/details/json?place_id={id}&fields={fields}&key={key}`
   - Fields: `place_id,name,rating,user_ratings_total,formatted_address,geometry,price_level,url,photos`
4. Build `photo_url`: `/api/places-photo?ref={encodeURIComponent(photo_reference)}` — never the raw reference
5. Return `PlacesEnrichment`

## Photo proxy

`app/api/places-photo/route.ts` — receives `?ref=` param, reads `GOOGLE_PLACES_API_KEY` from the server environment, calls Google Photos API, and returns image bytes. The raw `photo_reference` and API key never reach the client. If the environment variable is missing, the route returns HTTP 503; there is no hardcoded fallback key.

## Caching

None. Places enrichment is included in the board cache. On a cache hit, enrichment is not re-run.

## Failure handling

Returns `null` on any error (missing key, network error, API error, no results). Never throws. Board delivery is never blocked by enrichment failure.

## Unit tests

| Test | Covers success criterion |
|---|---|
| Returns `null` when `GOOGLE_PLACES_API_KEY` not set | Key-gated correctly |
| `photo_url` uses `/api/places-photo` proxy path, not raw Google URL | Photo proxied |
| `/api/places-photo` returns 503 when `GOOGLE_PLACES_API_KEY` is not set | Proxy fails closed without embedded secrets |
| Returns `null` when Text Search returns no results | No match → null |
| Returns `null` on network error (non-fatal) | Non-fatal failure |
| `locationHint !== name` uses `locationHint` as query | Query selection logic |
| `locationHint === name` uses `name + destination` as query | Fallback query |

## Open technical items

- No geographic bounding box on Text Search — "Angels Landing" could match a business in a different state
- No caching of individual Place lookups — 2 API calls per mappable card on every fresh board generation
- `is_mappable: false` cards are never enriched — correct, but `is_mappable` is LLM-generated and could be wrong
- `/api/enrich` client endpoint exists for on-demand UI enrichment but it is unclear if the UI currently calls it
