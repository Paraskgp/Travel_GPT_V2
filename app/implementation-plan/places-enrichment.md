# Implementation Plan: Places Enrichment

## Owns

`lib/places/client.ts` → `enrichExperience(name, locationHint, destination)`
`lib/pipeline/board.ts` → enrichment + grounding passes (steps 4 and 5 of the board pipeline)
`app/api/places-photo/route.ts` → photo proxy (API key never reaches client)
`app/api/enrich/route.ts` → on-demand enrichment from UI

## API version

Uses **Google Places API v1** (`places.googleapis.com/v1`), not the legacy API (`maps.googleapis.com/maps/api/place`). The v1 API uses field masks via the `X-Goog-FieldMask` request header instead of a `fields` query parameter.

## Inputs / Outputs

```typescript
enrichExperience(
  name: string,           // experience name — used as fallback query
  locationHint: string,   // specific place name — primary search query
  destination: string     // used in fallback query: "locationHint + destination"
): Promise<PlacesEnrichment | null>
// Returns null if GOOGLE_PLACES_API_KEY not set, or if lookup fails
```

```typescript
interface PlacesEnrichment {
  // ── Identity ──────────────────────────────────────────────────────────────
  place_id:    string
  name:        string
  address:     string | null
  short_address: string | null
  coordinates: { lat: number; lng: number } | null
  maps_url:    string | null
  website:     string | null      // stored for future scraping; not yet consumed
  phone:       string | null      // international format

  // ── Quality signals ───────────────────────────────────────────────────────
  rating:       number | null
  review_count: number | null
  price_level:  string | null     // "PRICE_LEVEL_FREE" | "PRICE_LEVEL_INEXPENSIVE" | etc.
  reviews:      GoogleReview[] | null   // up to 5, stored verbatim

  // ── Status ────────────────────────────────────────────────────────────────
  business_status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null
  opening_hours:   PlaceOpeningHours | null

  // ── Classification ────────────────────────────────────────────────────────
  types:        string[] | null   // e.g. ["museum", "point_of_interest"]
  primary_type: string | null     // e.g. "museum"

  // ── Editorial ─────────────────────────────────────────────────────────────
  editorial_summary: string | null

  // ── Attributes (all are direct Google booleans — no inference) ────────────
  good_for_children:      boolean | null
  good_for_groups:        boolean | null
  reservable:             boolean | null
  serves_vegetarian_food: boolean | null
  serves_beer:            boolean | null
  serves_wine:            boolean | null
  serves_cocktails:       boolean | null
  serves_coffee:          boolean | null
  serves_dessert:         boolean | null
  serves_breakfast:       boolean | null
  serves_lunch:           boolean | null
  serves_dinner:          boolean | null
  serves_brunch:          boolean | null
  live_music:             boolean | null
  outdoor_seating:        boolean | null
  delivery:               boolean | null
  dine_in:                boolean | null
  takeout:                boolean | null
  payment_options:        Record<string, boolean> | null
  parking_options:        Record<string, boolean> | null
  accessibility_options:  Record<string, boolean> | null

  // ── Media ─────────────────────────────────────────────────────────────────
  photo_url:  string | null    // proxied: /api/places-photo?name=...

  // ── Raw ───────────────────────────────────────────────────────────────────
  raw: Record<string, unknown>  // complete unprocessed API response
}

interface GoogleReview {
  author:        string
  rating:        number
  text:          string
  publish_time:  string
}

interface PlaceOpeningHours {
  open_now:     boolean | null
  periods:      Array<{ open: { day: number; hour: number; minute: number }; close: { day: number; hour: number; minute: number } }> | null
  weekday_text: string[] | null
}
```

Card-level field (on `Experience`):
```typescript
grounding_status: "operational" | "closed_temporarily" | "closed_permanently" | null
```
Derived from `places_enrichment.business_status` in the grounding pass. `null` when there is no enrichment.

## Steps

### Enrichment pass (in `generateBoard`, after tip enhancement)

1. If `!GOOGLE_PLACES_API_KEY` → skip all enrichment, log warning, continue
2. For each `is_mappable: true` experience, call `enrichExperience(name, locationHint, dest)` in parallel
3. `enrichExperience` internally:
   a. **Text Search** — `POST https://places.googleapis.com/v1/places:searchText`
      - Body: `{ "textQuery": query }` where `query = locationHint !== name ? locationHint : "${locationHint} ${destination}"`
      - Field mask header: `places.id,places.displayName,places.formattedAddress,places.location`
      - Take first result; extract `id` (the place_id)
   b. **Place Details** — `GET https://places.googleapis.com/v1/places/{id}`
      - Field mask header: all fields listed in the FIELD_MASK constant (see below)
      - Map API response to `PlacesEnrichment`, store complete response in `.raw`
   c. Build `photo_url` from first photo resource name: `/api/places-photo?name={encodeURIComponent(photos[0].name)}`
   d. Return `PlacesEnrichment` or `null` on any error

### Grounding pass (in `generateBoard`, after enrichment)

Single map over all themes/experiences. For each experience:
- If `places_enrichment?.business_status` exists → normalize to lowercase and set `grounding_status`
- Else → `grounding_status = null`

No other logic. The grounding pass is a direct, lossless projection of a single Google field.

```typescript
function groundingStatus(
  enrichment: PlacesEnrichment | null
): Experience["grounding_status"] {
  if (!enrichment?.business_status) return null
  const s = enrichment.business_status.toLowerCase()
  if (s === "operational") return "operational"
  if (s === "closed_temporarily") return "closed_temporarily"
  if (s === "closed_permanently") return "closed_permanently"
  return null
}
```

## FIELD_MASK constant

Requested on the Place Details call. Stored as a module-level constant so it is easy to extend:

```typescript
const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "googleMapsUri",
  "websiteUri",
  "internationalPhoneNumber",
  "rating",
  "userRatingCount",
  "priceLevel",
  "reviews",
  "businessStatus",
  "regularOpeningHours",
  "currentOpeningHours",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "editorialSummary",
  "goodForChildren",
  "goodForGroups",
  "reservable",
  "servesVegetarianFood",
  "servesBeer",
  "servesWine",
  "servesCocktails",
  "servesCoffee",
  "servesDessert",
  "servesBreakfast",
  "servesLunch",
  "servesDinner",
  "servesBrunch",
  "liveMusic",
  "menuForChildren",
  "outdoorSeating",
  "delivery",
  "dineIn",
  "takeout",
  "paymentOptions",
  "parkingOptions",
  "accessibilityOptions",
  "photos",
  "utcOffsetMinutes",
].join(",")
```

## Photo proxy

`app/api/places-photo/route.ts` — updated for v1 photo format:
- Receives `?name=` param (URL-encoded resource name, e.g. `places/ChIJ.../photos/A...`)
- Calls `https://places.googleapis.com/v1/{name}/media?maxWidthPx=800&key={KEY}`
- Streams image bytes to client
- Returns HTTP 503 if `GOOGLE_PLACES_API_KEY` is not set (no fallback key)

## Caching

Places enrichment results are included in the board cache — no separate enrichment cache. On a cache hit, enrichment is not re-run. The full `PlacesEnrichment` including `raw` is serialized into the board cache file.

## Failure handling

- `enrichExperience` never throws — catches all errors, returns `null`
- Board delivery is never blocked by enrichment failures
- Partial enrichment is normal (some cards may fail while others succeed)
- Grounding pass runs even if enrichment is partial — cards with `null` enrichment get `null` grounding_status

## Unit tests

| Test | Covers success criterion |
|---|---|
| Returns `null` when `GOOGLE_PLACES_API_KEY` not set | Key-gated correctly |
| `photo_url` uses `/api/places-photo` proxy, not raw Google URI | Photo proxied |
| `/api/places-photo` returns 503 when key not set | Proxy fails closed |
| `CLOSED_PERMANENTLY` business_status → `grounding_status: "closed_permanently"` | Grounding pass direct mapping |
| `OPERATIONAL` business_status → `grounding_status: "operational"` | Grounding pass direct mapping |
| `null` enrichment → `grounding_status: null` | Grounding handles missing enrichment |
| `raw` field contains the complete API response | Raw storage |
| Returns `null` on Text Search no-results | Non-match → null |
| Returns `null` on network error | Non-fatal failure |
| `locationHint !== name` → uses `locationHint` as query | Query selection |
| `locationHint === name` → uses `locationHint + destination` | Fallback query |

## Open technical items

- **Geographic bias:** Text Search has no location constraint. Add `locationBias` with a circular region around the destination's known coordinates to reduce cross-city false positives. (2026-05-29)
- **Photo gallery:** only `photos[0]` is used. `photos` array (up to 10) is in `raw`. Future UI gallery can read from there without a re-fetch. (2026-05-29)
- **Website scraping:** `website` is stored. A future `lib/scraping/` module should fetch and parse official venue websites to validate card claims. Do not add scraping to this client. (2026-05-29)
- **Per-card place cache:** individual Place Details responses could be cached by `place_id` with a 7-day TTL to avoid re-fetching stable venues on every board regeneration. (2026-05-29)
- **Review text mining:** reviews are in `raw.reviews`. A future eval module could use review text to validate LLM card claims (e.g., corroborate "great views", surface "closed for renovation" signals). (2026-05-29)
