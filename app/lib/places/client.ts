import { PlacesEnrichment } from "../types"

// Hardcoded for now — move to env later
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "AIzaSyA0C610pee1KhdCBUAt90qvjuXdhte2qBg"

const BASE = "https://maps.googleapis.com/maps/api/place"

interface TextSearchResult {
  place_id: string
  name: string
  rating?: number
  user_ratings_total?: number
  formatted_address?: string
  geometry?: { location: { lat: number; lng: number } }
  price_level?: number
}

interface PlaceDetailsResult {
  place_id: string
  name: string
  rating?: number
  user_ratings_total?: number
  formatted_address?: string
  geometry?: { location: { lat: number; lng: number } }
  price_level?: number
  url?: string                        // Google Maps link
  photos?: Array<{ photo_reference: string }>
}

export async function enrichExperience(
  name: string,
  locationHint: string,        // specific place name from LLM — more precise than name alone
  destination: string
): Promise<PlacesEnrichment | null> {
  if (!PLACES_API_KEY) {
    console.warn("[places] GOOGLE_PLACES_API_KEY not set — skipping enrichment")
    return null
  }

  // Use location_hint as primary search query — it's the specific place name
  // Fall back to "name + destination" if location_hint is the same as name
  const query = locationHint !== name ? locationHint : `${name} ${destination}`
  const searchQuery = encodeURIComponent(query)
  const searchUrl = `${BASE}/textsearch/json?query=${searchQuery}&key=${PLACES_API_KEY}`

  let placeId: string
  let candidate: TextSearchResult

  try {
    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()
    if (!searchData.results?.length) return null
    candidate = searchData.results[0] as TextSearchResult
    placeId = candidate.place_id
  } catch (err) {
    console.error("[places] text search failed:", err)
    return null
  }

  // Step 2: Place Details to get photo reference, Maps URL, and full fields
  const fields = "place_id,name,rating,user_ratings_total,formatted_address,geometry,price_level,url,photos"
  const detailsUrl = `${BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${PLACES_API_KEY}`

  let details: PlaceDetailsResult

  try {
    const detailsRes = await fetch(detailsUrl)
    const detailsData = await detailsRes.json()
    if (detailsData.status !== "OK") return null
    details = detailsData.result as PlaceDetailsResult
  } catch (err) {
    console.error("[places] place details failed:", err)
    return null
  }

  // Build photo URL — proxied through our own endpoint to keep the API key server-side
  let photo_url: string | null = null
  if (details.photos?.length) {
    const ref = details.photos[0].photo_reference
    // We proxy through /api/places-photo so the key never goes to the client
    photo_url = `/api/places-photo?ref=${encodeURIComponent(ref)}`
  }

  return {
    place_id: details.place_id,
    name: details.name,
    rating: details.rating ?? null,
    review_count: details.user_ratings_total ?? null,
    photo_url,
    address: details.formatted_address ?? null,
    coordinates: details.geometry?.location ?? null,
    maps_url: details.url ?? null,
    price_level: details.price_level ?? null,
  }
}
