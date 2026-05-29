import { PlacesEnrichment, PlaceOpeningHours, GoogleReview } from "../types"

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ""
const BASE_V1 = "https://places.googleapis.com/v1"

// ─── Field mask ───────────────────────────────────────────────────────────────
// All fields requested on the Place Details call.
// Add new fields here as the API expands — no other changes required.

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

// Text Search only needs identity fields — detailed data comes from the Details call
const TEXT_SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location"

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch full Google Places v1 data for a mappable experience card.
 *
 * Makes two calls: Text Search (to resolve a place_id) → Place Details (all fields).
 * Returns the complete PlacesEnrichment including a `raw` field with the unprocessed
 * API response, so callers always have access to the full record.
 *
 * Returns null if:
 * - GOOGLE_PLACES_API_KEY is not set
 * - Text Search returns no results
 * - Any network or API error occurs
 *
 * Never throws — all errors are caught and returned as null.
 */
export async function enrichExperience(
  name: string,
  locationHint: string,
  destination: string
): Promise<PlacesEnrichment | null> {
  if (!PLACES_API_KEY) {
    console.warn("[places] GOOGLE_PLACES_API_KEY not set — skipping enrichment")
    return null
  }

  // Build search query — prefer locationHint when it differs from name
  const query = locationHint !== name ? locationHint : `${locationHint} ${destination}`

  // ── Step 1: Text Search → resolve place_id ────────────────────────────────
  let placeId: string
  try {
    const searchRes = await fetch(`${BASE_V1}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": PLACES_API_KEY,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query }),
    })
    const searchData = await searchRes.json()
    if (!searchData.places?.length) {
      console.warn(`[places] no results for query: "${query}"`)
      return null
    }
    placeId = searchData.places[0].id
  } catch (err) {
    console.error("[places] text search failed:", err)
    return null
  }

  // ── Step 2: Place Details → all fields ────────────────────────────────────
  let raw: Record<string, unknown>
  try {
    const detailsRes = await fetch(`${BASE_V1}/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": PLACES_API_KEY,
        "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
      },
    })
    const detailsData = await detailsRes.json()
    if (detailsData.error) {
      console.error("[places] place details error:", detailsData.error)
      return null
    }
    raw = detailsData as Record<string, unknown>
  } catch (err) {
    console.error("[places] place details failed:", err)
    return null
  }

  return buildEnrichment(placeId, raw)
}

// ─── Internal mapping ─────────────────────────────────────────────────────────

/**
 * Map a raw Places v1 API response to a PlacesEnrichment.
 * Every field maps 1:1 from the API response — no inference or derivation.
 * The complete raw response is stored in `.raw` for forward-compatibility.
 */
function buildEnrichment(placeId: string, raw: Record<string, unknown>): PlacesEnrichment {
  const location = raw.location as { latitude: number; longitude: number } | undefined
  const displayName = raw.displayName as { text: string } | undefined
  const editorialSummary = raw.editorialSummary as { text: string } | undefined
  const primaryTypeDisplayName = raw.primaryTypeDisplayName as { text: string } | undefined

  // Photo URL — proxied through /api/places-photo to keep API key server-side
  let photo_url: string | null = null
  const photos = raw.photos as Array<{ name: string }> | undefined
  if (photos?.length) {
    photo_url = `/api/places-photo?name=${encodeURIComponent(photos[0].name)}`
  }

  // Opening hours — prefer currentOpeningHours (real-time) over regularOpeningHours
  const hoursSource = (raw.currentOpeningHours ?? raw.regularOpeningHours) as Record<string, unknown> | undefined
  const opening_hours: PlaceOpeningHours | null = hoursSource
    ? {
        open_now:     (hoursSource.openNow as boolean | undefined) ?? null,
        periods:      (hoursSource.periods as PlaceOpeningHours["periods"]) ?? null,
        weekday_text: (hoursSource.weekdayDescriptions as string[]) ?? null,
      }
    : null

  // Reviews
  const rawReviews = raw.reviews as Array<Record<string, unknown>> | undefined
  const reviews: GoogleReview[] | null = rawReviews?.map(r => ({
    author:       (r.authorAttribution as { displayName?: string })?.displayName ?? "",
    rating:       (r.rating as number) ?? 0,
    text:         (r.text as { text?: string })?.text ?? "",
    publish_time: (r.publishTime as string) ?? "",
  })) ?? null

  return {
    // Identity
    place_id:      placeId,
    name:          displayName?.text ?? "",
    address:       (raw.formattedAddress as string | undefined) ?? null,
    short_address: (raw.shortFormattedAddress as string | undefined) ?? null,
    coordinates:   location ? { lat: location.latitude, lng: location.longitude } : null,
    maps_url:      (raw.googleMapsUri as string | undefined) ?? null,
    website:       (raw.websiteUri as string | undefined) ?? null,
    phone:         (raw.internationalPhoneNumber as string | undefined) ?? null,

    // Quality
    rating:        (raw.rating as number | undefined) ?? null,
    review_count:  (raw.userRatingCount as number | undefined) ?? null,
    price_level:   (raw.priceLevel as string | undefined) ?? null,
    reviews:       reviews?.length ? reviews : null,

    // Status
    business_status: (raw.businessStatus as PlacesEnrichment["business_status"]) ?? null,
    opening_hours,

    // Classification
    types:         (raw.types as string[] | undefined) ?? null,
    primary_type:  (raw.primaryType as string | undefined)
                   ?? primaryTypeDisplayName?.text
                   ?? null,

    // Editorial
    editorial_summary: editorialSummary?.text ?? null,

    // Attributes — direct boolean pass-through, no inference
    good_for_children:      boolOrNull(raw, "goodForChildren"),
    good_for_groups:        boolOrNull(raw, "goodForGroups"),
    reservable:             boolOrNull(raw, "reservable"),
    serves_vegetarian_food: boolOrNull(raw, "servesVegetarianFood"),
    serves_beer:            boolOrNull(raw, "servesBeer"),
    serves_wine:            boolOrNull(raw, "servesWine"),
    serves_cocktails:       boolOrNull(raw, "servesCocktails"),
    serves_coffee:          boolOrNull(raw, "servesCoffee"),
    serves_dessert:         boolOrNull(raw, "servesDessert"),
    serves_breakfast:       boolOrNull(raw, "servesBreakfast"),
    serves_lunch:           boolOrNull(raw, "servesLunch"),
    serves_dinner:          boolOrNull(raw, "servesDinner"),
    serves_brunch:          boolOrNull(raw, "servesBrunch"),
    live_music:             boolOrNull(raw, "liveMusic"),
    outdoor_seating:        boolOrNull(raw, "outdoorSeating"),
    delivery:               boolOrNull(raw, "delivery"),
    dine_in:                boolOrNull(raw, "dineIn"),
    takeout:                boolOrNull(raw, "takeout"),
    payment_options:        objectOrNull(raw, "paymentOptions"),
    parking_options:        objectOrNull(raw, "parkingOptions"),
    accessibility_options:  objectOrNull(raw, "accessibilityOptions"),

    // Media
    photo_url,

    // Complete raw response — stored verbatim for future use
    raw,
  }
}

function boolOrNull(obj: Record<string, unknown>, key: string): boolean | null {
  const v = obj[key]
  return typeof v === "boolean" ? v : null
}

function objectOrNull(obj: Record<string, unknown>, key: string): Record<string, boolean> | null {
  const v = obj[key]
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, boolean>)
    : null
}
