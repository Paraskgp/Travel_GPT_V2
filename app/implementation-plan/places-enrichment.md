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

Card-level fields (on `Experience`):
```typescript
grounding_status: "operational" | "closed_temporarily" | "closed_permanently" | null
// Direct projection of places_enrichment.business_status. null when no enrichment.

is_area_experience: boolean
// true when Google's types array contains a geographic area classifier.
// Set by the LLM at generation time; confirmed or overridden by the grounding pass.
// Never inferred from rating, review count, or any proxy signal.

nav_anchor: string | null
// For area experiences: the specific named starting point the traveler navigates to.
// e.g. "Shimokitazawa Station South Exit" or "top of Hanamikoji-dori at Shijo-dori".
// Set by the LLM. null for point experiences (location_hint is already the destination).
```

`is_area_experience` is set by the LLM initially using its knowledge of the place. The grounding pass may confirm or override it using Google's authoritative `types` array — no heuristics.

`nav_anchor` is set by the LLM only. The grounding pass does not touch it.

### AREA_TYPES classifier set

The grounding pass uses this set to determine whether a Google-matched result is an area entity:

```typescript
const GOOGLE_AREA_TYPES = new Set([
  "neighborhood",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "locality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "political",
  "colloquial_area",
  "route",
])
```

This set is the complete classifier. Any `types` value in this set means Google matched an area, not a venue. The set should be extended as Google's taxonomy evolves — it should never be replaced with heuristics.

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

1. **`grounding_status`** — direct projection of `places_enrichment.business_status`:
   - `"OPERATIONAL"` → `"operational"`
   - `"CLOSED_TEMPORARILY"` → `"closed_temporarily"`
   - `"CLOSED_PERMANENTLY"` → `"closed_permanently"`
   - absent or null → `null`

2. **`is_area_experience`** — set from Google's `types` array using the `GOOGLE_AREA_TYPES` set:
   - If `places_enrichment.types` contains any value in `GOOGLE_AREA_TYPES` → `true`
   - If `places_enrichment.types` is present and contains no area classifier → `false`
   - If `places_enrichment` is `null` (no enrichment) → keep the LLM-generated value unchanged

No other logic. The grounding pass projects Google's own signals to card-level fields. It does not modify `nav_anchor`.

```typescript
function groundingStatus(
  status: string | null
): Experience["grounding_status"] {
  if (!status) return null
  const s = status.toUpperCase()
  if (s === "OPERATIONAL")        return "operational"
  if (s === "CLOSED_TEMPORARILY") return "closed_temporarily"
  if (s === "CLOSED_PERMANENTLY") return "closed_permanently"
  return null
}

function isAreaExperience(
  types: string[] | null | undefined,
  llmValue: boolean
): boolean {
  if (!types) return llmValue   // no enrichment — trust LLM
  return types.some(t => GOOGLE_AREA_TYPES.has(t))
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
| types `["neighborhood", "political"]` → `is_area_experience: true` | Area classifier — Google types override |
| types `["museum", "point_of_interest"]` → `is_area_experience: false` | Point venue — Google types override |
| `null` enrichment → `is_area_experience` retains LLM-generated value | No enrichment → trust LLM |
| `nav_anchor` is not modified by the grounding pass | nav_anchor is LLM-only |

## Open technical items

- **Geographic bias:** Text Search has no location constraint. Add `locationBias` with a circular region around the destination's known coordinates to reduce cross-city false positives. (2026-05-29)
- **Photo gallery:** only `photos[0]` is used. `photos` array (up to 10) is in `raw`. Future UI gallery can read from there without a re-fetch. (2026-05-29)
- **Website scraping:** `website` is stored. A future `lib/scraping/` module should fetch and parse official venue websites to validate card claims. Do not add scraping to this client. (2026-05-29)
- **Per-card place cache:** individual Place Details responses could be cached by `place_id` with a 7-day TTL to avoid re-fetching stable venues on every board regeneration. (2026-05-29)
- **Review text mining:** reviews are in `raw.reviews`. A future eval module could use review text to validate LLM card claims (e.g., corroborate "great views", surface "closed for renovation" signals). (2026-05-29)
