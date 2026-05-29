import { callLLM, Provider } from "../llm/client"
import { cacheRead, cacheWrite, boardCacheKey, TTL } from "../cache"
import {
  themeSystemPrompt, themeUserPrompt,
  tipEnhancementSystemPrompt, tipEnhancementUserPrompt,
} from "../claude/prompts"
import { DestinationContext, WeatherContext, GroundedExperience, Theme, Preferences } from "../types"
import { enrichExperience } from "../places/client"
import { evaluateBoard } from "./board-eval"
import { parseJSON } from "../utils/parse-json"

export interface BoardResult {
  themes: Theme[]
  eval_gaps: string[]
}

/**
 * Generate (or load from cache) the full board for a destination.
 *
 * Covers the complete board pipeline:
 *   1. Two-wave theme generation (signature first, then all others in parallel)
 *   2. Server-side experience deduplication
 *   3. Tip enhancement pass (parallel per experience)
 *   4. Google Places enrichment pass (parallel, only for is_mappable experiences)
 *   5. Grounding pass (business_status → grounding_status, types → is_area_experience)
 *   6. Board completeness eval (senior-editor gap detection)
 *
 * Cache: keyed by prompt hash — auto-invalidates when any prompt file changes.
 *
 * @param prefs  Board generation preferences. Caller is responsible for stripping
 *               party_type before calling (board cache is party_type-agnostic).
 */
export async function generateBoard(
  dest: string,
  destCtx: DestinationContext,
  weatherCtx: WeatherContext | null,
  experiences: GroundedExperience[],
  prefs: Preferences,
  provider: Provider = "openai"
): Promise<BoardResult> {
  const bKey = boardCacheKey()
  const cached = cacheRead<{ themes: Theme[]; eval_gaps?: string[]; generated_at: string }>(dest, bKey)
  if (cached) {
    console.log(`[pipeline/board] cache HIT — ${cached.themes.length} themes`)
    return { themes: cached.themes, eval_gaps: cached.eval_gaps ?? [] }
  }

  // ── Wave 1: Signature theme ──────────────────────────────────────────────────
  const rawApplicable = destCtx.applicable_themes.filter(id => THEME_NAMES[id])
  const applicableThemes = rawApplicable.includes("signature")
    ? rawApplicable
    : ["signature", ...rawApplicable]

  const sysPrompt = themeSystemPrompt()
  const groundedInput = experiences.length > 0 ? experiences : undefined

  let signatureTheme: Theme | null = null
  if (applicableThemes.includes("signature")) {
    try {
      const raw = await callLLM(
        sysPrompt,
        themeUserPrompt("signature", dest, destCtx, weatherCtx, prefs, undefined, groundedInput),
        provider,
        "board_generation"
      )
      signatureTheme = parseJSON<Theme>(raw)
    } catch (err) {
      console.warn("[pipeline/board] signature theme failed:", err)
    }
  }

  // ── Wave 2: All other themes in parallel ────────────────────────────────────
  const usedExperiences = signatureTheme?.experiences.map(e => ({
    name: e.name,
    location_hint: e.location_hint,
  })) ?? []

  const remainingThemes = applicableThemes.filter(id => id !== "signature")
  const wave2Results = await Promise.allSettled(
    remainingThemes.map(themeId =>
      callLLM(
        sysPrompt,
        themeUserPrompt(themeId, dest, destCtx, weatherCtx, prefs, usedExperiences, groundedInput),
        provider,
        "board_generation"
      ).then(raw => parseJSON<Theme>(raw))
    )
  )

  const rawThemes: Array<{ theme: Theme; themeId: string }> = []
  if (signatureTheme) rawThemes.push({ theme: signatureTheme, themeId: "signature" })
  wave2Results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      rawThemes.push({ theme: result.value, themeId: remainingThemes[i] })
    } else {
      console.warn(`[pipeline/board] theme "${remainingThemes[i]}" failed:`, result.reason)
    }
  })

  // ── Dedup ────────────────────────────────────────────────────────────────────
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const themes: Theme[] = []
  rawThemes.forEach(({ theme }) => {
    const deduped = theme.experiences.filter(e => {
      const normId = e.id.trim().toLowerCase()
      const normName = e.name.trim().toLowerCase()
      if (seenIds.has(normId) || seenNames.has(normName)) return false
      seenIds.add(normId)
      seenNames.add(normName)
      return true
    })
    if (deduped.length > 0) themes.push({ ...theme, experiences: deduped })
  })

  // ── Tip enhancement (parallel per experience) ────────────────────────────────
  const tipSysPrompt = tipEnhancementSystemPrompt()
  let enhancedThemes = await Promise.all(
    themes.map(async theme => {
      const enhancedExperiences = await Promise.all(
        theme.experiences.map(async exp => {
          try {
            const enhanced = await callLLM(
              tipSysPrompt,
              tipEnhancementUserPrompt(exp.name, exp.location_hint ?? dest, dest, theme.name, exp.local_tip),
              provider,
              "tip_enhancement"
            )
            return { ...exp, local_tip: enhanced.trim() || exp.local_tip }
          } catch {
            return exp
          }
        })
      )
      return { ...theme, experiences: enhancedExperiences }
    })
  )

  // ── Places enrichment (parallel, is_mappable only) ───────────────────────────
  if (process.env.GOOGLE_PLACES_API_KEY) {
    enhancedThemes = await Promise.all(
      enhancedThemes.map(async theme => {
        const enrichedExperiences = await Promise.all(
          theme.experiences.map(async exp => {
            if (!exp.is_mappable) return exp
            try {
              const enrichment = await enrichExperience(exp.name, exp.location_hint ?? dest, dest)
              return { ...exp, places_enrichment: enrichment }
            } catch {
              return exp
            }
          })
        )
        return { ...theme, experiences: enrichedExperiences }
      })
    )
    const enrichedCount = enhancedThemes.flatMap(t => t.experiences).filter(e => e.places_enrichment).length
    console.log(`[pipeline/board] Places enrichment — ${enrichedCount} cards enriched`)
  }

  // ── Grounding pass — project Google's signals to card-level fields ──────────
  // Two projections, both lossless pass-throughs of Google's own data:
  //   1. business_status → grounding_status (operational/closed)
  //   2. types[]         → is_area_experience (point venue vs. walkable area)
  // No rules engine. No interpretation. What Google says, the card says.
  // If enrichment is null, grounding_status is null and is_area_experience
  // retains the LLM-generated value — Google's absence is not an override.
  enhancedThemes = enhancedThemes.map(theme => ({
    ...theme,
    experiences: theme.experiences.map(exp => ({
      ...exp,
      grounding_status: groundingStatus(exp.places_enrichment?.business_status ?? null),
      is_area_experience: resolveIsArea(exp.places_enrichment?.types ?? null, exp.is_area_experience),
    })),
  }))

  // ── Board completeness eval ──────────────────────────────────────────────────
  // Senior-editor pass: what's clearly missing that every serious guide covers?
  // Non-fatal — eval failure yields [] and board is cached normally.
  const evalGaps = await evaluateBoard(dest, enhancedThemes, provider)
  if (evalGaps.length > 0) {
    console.log(`[pipeline/board] completeness gaps (${evalGaps.length}):`)
    evalGaps.forEach(g => console.log(`  ⚠️  ${g}`))
  } else {
    console.log("[pipeline/board] completeness eval — no gaps found")
  }

  // ── Write to cache ───────────────────────────────────────────────────────────
  cacheWrite(
    dest,
    bKey,
    { themes: enhancedThemes, eval_gaps: evalGaps, generated_at: new Date().toISOString() },
    TTL.BOARD,
    bKey.replace("board_", "")
  )

  return { themes: enhancedThemes, eval_gaps: evalGaps }
}

// ── Internal ─────────────────────────────────────────────────────────────────

/**
 * Direct projection of Google's businessStatus string to the card-level grounding_status enum.
 * No inference. No rules. One field in, one field out.
 */
function groundingStatus(
  status: string | null
): "operational" | "closed_temporarily" | "closed_permanently" | null {
  if (!status) return null
  const s = status.toUpperCase()
  if (s === "OPERATIONAL")        return "operational"
  if (s === "CLOSED_TEMPORARILY") return "closed_temporarily"
  if (s === "CLOSED_PERMANENTLY") return "closed_permanently"
  return null
}

/**
 * Google's place type taxonomy values that indicate an area/region entity rather than
 * a specific addressable venue. When any of these appear in a place's `types` array,
 * the Google match is a geographic area — not a pin.
 *
 * Source: https://developers.google.com/maps/documentation/places/web-service/place-types
 * Extend this set as Google's taxonomy evolves. Never replace with heuristics.
 */
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

/**
 * Resolve is_area_experience from Google's types array.
 * If enrichment types are present, Google's taxonomy is authoritative.
 * If types is null (no enrichment), fall back to the LLM-generated value.
 */
function resolveIsArea(
  types: string[] | null,
  llmValue: boolean
): boolean {
  if (!types) return llmValue
  return types.some(t => GOOGLE_AREA_TYPES.has(t))
}

const THEME_NAMES: Record<string, string> = {
  signature:    "Signature Experiences",
  unique_local: "Unique & Local",
  food_drink:   "Food & Drink",
  food_crawls:  "Food Crawls, Markets & Neighborhoods",
  adventure:    "Adventure",
  nature:       "Nature & Scenic",
  hiking:       "Hiking & Outdoors",
  culture:      "Culture & History",
  arts:         "Arts & Workshops",
  family:       "Family-Friendly",
  romantic:     "Romantic & Special Occasion",
  rainy_day:    "Rainy Day",
  nightlife:    "Nightlife",
  shopping:     "Shopping & Markets",
  day_trips:    "Day Trips",
  seasonal:     "Seasonal & Time-Bound",
}
