// ─── Request ──────────────────────────────────────────────────────────────────

export interface Preferences {
  dietary?: string[]      // "vegetarian" | "vegan" | "halal" | "kosher" | "allergy_aware"
  interests?: string[]    // "food" | "hiking" | "nature" | "culture" | "adventure" | "arts" | "nightlife" | "shopping" | "family"
  party_type?: string     // "solo" | "couple" | "family_young" | "family_teens" | "older_parents"
  pace?: string           // "relaxed" | "moderate" | "packed"
  budget?: string         // "budget" | "mid" | "premium"
  duration_days?: number
  avoid?: string[]        // "alcohol" | "crowds" | "extreme_physical" | "expensive" | "tourist_traps"
}

export interface GenerateRequest {
  destination: string
  month?: string          // e.g. "March" or "March 2025" — used for weather context
  dates?: string          // e.g. "March 15–22, 2025" — more specific, overrides month if both provided
  preferences?: Preferences
}

// ─── Pipeline Nodes ───────────────────────────────────────────────────────────

export interface DestinationContext {
  destination: string
  soul: string                      // 2–3 paragraphs. The spirit of the place — what makes it itself.
  defining_pillars: string[]        // 4–6 short phrases: the things that define this destination
  best_for: string[]                // Types of travelers it suits most
  honest_notes: string[]           // Honest caveats — not a negative list, just what to know going in
  applicable_themes: string[]       // Theme IDs from the approved list that genuinely apply here
}

export type SeasonType = "off_season" | "shoulder_season" | "peak_season"

export interface WeatherMonth {
  avg_high_f: number
  avg_low_f: number
  avg_high_c: number
  avg_low_c: number
  avg_rainfall_inches: number
  rainy_days_estimate: number
  avg_wind_mph: number
  humidity_pct: number
  uv_index: string                  // "Low" | "Moderate" | "High" | "Very High" | "Extreme"
  sunrise: string                   // e.g. "6:15 AM"
  sunset: string                    // e.g. "6:45 PM"
  daylight_hours: number
  season_type: SeasonType
  season_notes: string              // One line — what this month means for travel
}

export interface WeatherContext {
  destination: string
  travel_month: string | null       // The month the traveler is going — used for highlighting
  annual_summary: string            // One paragraph on the overall climate character of this destination
  months: Record<string, WeatherMonth>  // All 12 months keyed by name e.g. "January"
  travel_implications: string[]     // 3–5 actionable notes specific to the travel_month (or general if no month)
}

// ─── Google Places Enrichment ─────────────────────────────────────────────────

export interface PlacesEnrichment {
  place_id: string
  name: string                      // Matched place name from Google
  rating: number | null             // e.g. 4.7
  review_count: number | null       // e.g. 1243
  photo_url: string | null          // Single photo URL (proxied through /api/places-photo)
  address: string | null
  coordinates: { lat: number; lng: number } | null
  maps_url: string | null           // Google Maps link
  price_level: number | null        // 0 = free, 1–4 = $ to $$$$
}

// ─── Experience Card ──────────────────────────────────────────────────────────

export interface Experience {
  id: string
  name: string
  short_description: string         // 1–2 punchy sentences
  long_description: string          // 2–3 paragraphs: what it is, why it matters, how to do it well
  tags: string[]                    // 2–4 lowercase tags e.g. ["outdoor", "morning", "romantic"]
  why_worth_it: string              // One compelling sentence
  duration: string                  // e.g. "2–3 hours" or "Half day"
  effort: "easy" | "moderate" | "strenuous"
  cost_band: "free" | "budget" | "mid" | "premium"
  booking_difficulty: "walk_in" | "reserve_ahead" | "hard_to_get"
  best_time: string                 // Specific — time of day + season note if relevant
  local_tip: string                 // One specific, actionable tip
  who_for: string[]
  what_to_bring?: string[]
  watch_out_for?: string
  nearby_pairings?: string[]
  dietary_flags?: string[]          // "vegetarian_friendly" | "vegan_friendly" | "alcohol_centered" | "meat_heavy" | "kid_friendly"
  suitability_tags?: string[]       // "family_friendly" | "romantic" | "accessible" | "solo_friendly"
  weather_sensitivity?: string      // e.g. "Best avoided in rain" or "Better in cooler months"
  location_hint: string             // Specific named place where the experience happens. Required on every card.
  personalization_note: string | null

  // Set by LLM — true if location_hint is findable on Google Maps (should be almost always true)
  is_mappable: boolean

  // Populated by /api/enrich after generation. null until enriched.
  places_enrichment: PlacesEnrichment | null
}

// ─── Board ────────────────────────────────────────────────────────────────────

export interface Theme {
  id: string
  name: string
  description: string
  experiences: Experience[]
}

export interface Board {
  destination: string
  destination_context: DestinationContext
  weather_context: WeatherContext
  themes: Theme[]
  generated_at: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface GenerateResponse {
  board: Board
}

export interface ErrorResponse {
  error: string
}
