import { Experience, FeedbackCardContext, Theme } from "@/lib/types"

/**
 * Build the compact feedback context for a single experience card.
 *
 * Includes visible product fields and a Places summary, but excludes raw provider
 * payloads and full board data.
 */
export function buildFeedbackCardContext(exp: Experience, theme: Theme): FeedbackCardContext {
  return {
    experience_id: exp.id,
    experience_name: exp.name,
    theme_id: theme.id,
    theme_name: theme.name,
    visible_fields: {
      short_description: exp.short_description,
      duration: exp.duration,
      effort: exp.effort,
      cost_band: exp.cost_band,
      booking_difficulty: exp.booking_difficulty,
      location_hint: exp.location_hint,
      personalization_note: exp.personalization_note,
      tags: exp.tags,
      ...(exp.local_tip ? { local_tip: exp.local_tip } : {}),
    },
    places_summary: exp.places_enrichment
      ? {
          place_id: exp.places_enrichment.place_id,
          matched_name: exp.places_enrichment.name,
          address: exp.places_enrichment.address,
          rating: exp.places_enrichment.rating,
          review_count: exp.places_enrichment.review_count,
          business_status: exp.places_enrichment.business_status,
          primary_type: exp.places_enrichment.primary_type,
          maps_url: exp.places_enrichment.maps_url,
        }
      : null,
    grounding_status: exp.grounding_status,
    is_mappable: exp.is_mappable,
    is_area_experience: exp.is_area_experience,
    nav_anchor: exp.nav_anchor,
  }
}
