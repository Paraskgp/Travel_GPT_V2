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
  month?: string          // legacy — kept for backwards compat with compact header form
  dates?: string          // legacy — kept for backwards compat
  start_date?: string     // ISO date e.g. "2025-03-15"
  end_date?: string       // ISO date e.g. "2025-03-22"
  arrival_time?: string   // e.g. "09:00" — when first activity starts on day 1
  departure_time?: string // e.g. "14:00" — hard cutoff on last day
  preferences?: Preferences
}

// ─── Search Grounding ─────────────────────────────────────────────────────────

/**
 * Raw extraction from a single page (map phase output).
 * May contain duplicates across pages — fed into dedupExperiences to produce GroundedExperience[].
 */
export interface RawExperience {
  name: string            // Real, specific name of the place or experience
  location: string        // As specific as the source allows — includes state/region
  category: string        // "trail" | "restaurant" | "viewpoint" | "museum" | "tour" | ...
  key_facts: string[]     // 1–4 factual bullets extracted from this page only
  source_url: string      // The page this was extracted from
}

/**
 * A verified real-world experience after deduplication and merging across all sources.
 * Produced by dedupExperiences (reduce phase) and injected into board generation
 * as the "Known verified experiences" block — the hallucination firewall.
 */
export interface GroundedExperience {
  name: string            // The real, verifiable name of the place or experience
  location: string        // Most specific location across all sources
  category: string        // e.g. "trail", "viewpoint", "restaurant", "museum", "tour"
  key_facts: string[]     // Richest merged set of facts across all sources
  source_urls: string[]   // All pages that mentioned this experience
}

// ─── Pipeline Nodes ───────────────────────────────────────────────────────────

export interface DestinationContext {
  destination: string
  soul: string                      // 2–3 paragraphs. The spirit of the place — what makes it itself.
  defining_pillars: string[]        // 4–6 short phrases: the things that define this destination
  best_for: string[]                // Types of travelers it suits most
  honest_notes: string[]           // Honest caveats — not a negative list, just what to know going in
  applicable_themes: string[]       // Theme IDs from the approved list that genuinely apply here
  recommended_stay_area: string     // Best area/lodge/neighborhood to base yourself — used as itinerary anchor
  recommended_stay_reason: string   // One sentence explaining why
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

export interface PlaceOpeningHours {
  open_now:     boolean | null
  periods:      Array<{
    open:  { day: number; hour: number; minute: number }
    close: { day: number; hour: number; minute: number }
  }> | null
  weekday_text: string[] | null     // e.g. ["Monday: 9:00 AM – 5:00 PM", ...]
}

export interface GoogleReview {
  author:       string
  rating:       number
  text:         string
  publish_time: string
}

export interface PlacesEnrichment {
  // ── Identity ────────────────────────────────────────────────────────────────
  place_id:      string
  name:          string                                  // Google matched name
  address:       string | null                           // formatted address
  short_address: string | null                           // shorter display address
  coordinates:   { lat: number; lng: number } | null
  maps_url:      string | null                           // Google Maps URI
  website:       string | null                           // official site — for future scraping
  phone:         string | null                           // international format

  // ── Quality signals ─────────────────────────────────────────────────────────
  rating:        number | null                           // e.g. 4.7
  review_count:  number | null                           // e.g. 1243
  price_level:   string | null                           // "PRICE_LEVEL_FREE" | "PRICE_LEVEL_INEXPENSIVE" | "PRICE_LEVEL_MODERATE" | "PRICE_LEVEL_EXPENSIVE" | "PRICE_LEVEL_VERY_EXPENSIVE"
  reviews:       GoogleReview[] | null                   // up to 5, verbatim from Google

  // ── Status ──────────────────────────────────────────────────────────────────
  business_status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null
  opening_hours:   PlaceOpeningHours | null

  // ── Classification ──────────────────────────────────────────────────────────
  types:        string[] | null                          // e.g. ["museum", "point_of_interest"]
  primary_type: string | null                            // e.g. "museum"

  // ── Editorial ───────────────────────────────────────────────────────────────
  editorial_summary: string | null

  // ── Attributes — all direct Google booleans, no inference ───────────────────
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

  // ── Media ───────────────────────────────────────────────────────────────────
  photo_url: string | null                               // proxied: /api/places-photo?name=...

  // ── Raw ─────────────────────────────────────────────────────────────────────
  raw: Record<string, unknown>                           // complete unprocessed API response
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

  // Set by LLM at generation time; confirmed or overridden by the grounding pass using
  // Google's types array. true when the matched place is a district/region rather than
  // a specific addressable venue. Never inferred from rating or review count.
  is_area_experience: boolean

  // For area experiences only: the specific named starting point the traveler should
  // navigate to (e.g. "Shimokitazawa Station South Exit"). Set by LLM. null for point
  // experiences, where location_hint is already the navigation destination.
  nav_anchor: string | null

  // Populated by Places enrichment pass. null until enriched.
  places_enrichment: PlacesEnrichment | null

  // Direct projection of places_enrichment.business_status — set by grounding pass.
  // null when no enrichment. Never inferred — always sourced verbatim from Google.
  grounding_status: "operational" | "closed_temporarily" | "closed_permanently" | null
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
  weather_context: WeatherContext | null
  themes: Theme[]
  preferences?: Preferences
  generated_at: string
}

// ─── Clustering ──────────────────────────────────────────────────────────────

export interface TravelPair {
  from_id: string             // experience id
  to_id: string               // experience id
  walk_min: number            // estimated walking minutes (999 if not walkable)
  drive_min: number           // estimated driving minutes
  mode: "walk" | "car"        // recommended mode for a typical traveler
}

export interface ExperienceCluster {
  id: string                  // e.g. "cluster-old-faithful-basin"
  name: string                // display name e.g. "Old Faithful Basin"
  anchor_id: string           // the experience that defines the cluster's location
  experience_ids: string[]    // all experiences in this cluster
  zone: string                // named geographic zone e.g. "Geyser Country"
  cluster_note: string | null // caveats — elevation, family suitability, logistics
}

export interface ClusterResult {
  pairs: TravelPair[]
  clusters: ExperienceCluster[]
}

// ─── Itinerary Planning ───────────────────────────────────────────────────────

export interface ItineraryRow {
  type: "activity" | "travel" | "meal"
  start_time: string          // e.g. "09:00"
  end_time: string            // e.g. "11:30"
  title: string               // activity/restaurant name or "Walk to X" / "Drive to X"
  notes: string               // local tip, context, or travel instruction
  planning_note: string | null // user-facing reasoning: why this is scheduled here, what to expect
  maps_url: string | null     // Google Maps link — null for travel rows with no fixed destination
  experience_id: string | null // links back to the board experience; null for meals/travel
  effort?: "easy" | "moderate" | "strenuous" | null // copied from experience card; null for travel/meal rows
}

export interface ItineraryDay {
  date: string                // ISO date e.g. "2025-03-15"
  day_number: number          // 1-indexed
  day_title: string           // e.g. "Geyser Country"
  rows: ItineraryRow[]
}

export interface Itinerary {
  destination: string
  start_date: string
  end_date: string
  days: ItineraryDay[]
  change_log: string[]        // Pass 2 reviewer notes — what was adjusted and why (internal)
  generated_at: string
}

export interface PlanRequest {
  board: Board
  start_date: string
  end_date: string
  arrival_time?: string       // e.g. "09:00"
  departure_time?: string     // e.g. "14:00"
  stay_area?: string          // where they're sleeping — anchor for all day routing
  preferences?: Preferences   // traveler preferences — used for party-type filtering etc.
  forced_ids?: string[]       // user said "must include these"
  skipped_ids?: string[]      // user said "skip these"
}

export interface PlanResponse {
  itinerary: Itinerary
  clusters?: ClusterResult  // included for debugging / UI map use
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface GenerateResponse {
  board: Board
}

export interface ErrorResponse {
  error: string
}
