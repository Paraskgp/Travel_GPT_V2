import { NextRequest, NextResponse } from "next/server"
import { callLLM, Provider } from "@/lib/llm/client"
import {
  destinationContextSystemPrompt,
  destinationContextUserPrompt,
  weatherContextSystemPrompt,
  weatherContextUserPrompt,
  themeSystemPrompt,
  themeUserPrompt,
  tipEnhancementSystemPrompt,
  tipEnhancementUserPrompt,
} from "@/lib/claude/prompts"
import {
  Board,
  DestinationContext,
  WeatherContext,
  Theme,
  GenerateRequest,
  GenerateResponse,
  ErrorResponse,
} from "@/lib/types"

export const maxDuration = 180

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

function parseJSON<T>(raw: string): T {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  return JSON.parse(stripped) as T
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<GenerateResponse | ErrorResponse>> {
  let body: GenerateRequest & { provider?: Provider }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { destination, month, dates, start_date, end_date, arrival_time, preferences, provider = "openai" } = body

  if (!destination?.trim()) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 })
  }

  const dest = destination.trim()

  // Derive travel month from start_date if provided, fall back to legacy fields
  const travelMonth = start_date
    ? new Date(start_date + "T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })
    : (dates ?? month ?? null)

  // Derive trip length from date range — inject into preferences so themes can calibrate depth
  let enrichedPrefs = preferences ?? {}
  if (start_date && end_date) {
    const msPerDay = 1000 * 60 * 60 * 24
    const days = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / msPerDay) + 1
    if (days > 0) enrichedPrefs = { ...enrichedPrefs, duration_days: days }
  }

  // ── Node 1 + 2: Run destination context and weather context in parallel ────
  const contextCalls: [Promise<string>, Promise<string>] = [
    callLLM(destinationContextSystemPrompt(), destinationContextUserPrompt(dest), provider),
    callLLM(weatherContextSystemPrompt(), weatherContextUserPrompt(dest, travelMonth), provider),
  ]

  let destContext: DestinationContext
  let weatherContext: WeatherContext | null = null

  try {
    const [destRaw, weatherRaw] = await Promise.all(contextCalls)
    destContext = parseJSON<DestinationContext>(destRaw)
    weatherContext = parseJSON<WeatherContext>(weatherRaw)
  } catch (err) {
    console.error("[/api/generate] context nodes failed:", err)
    return NextResponse.json({ error: "Failed to generate destination context" }, { status: 500 })
  }

  // ── Node 3+: Two-wave theme generation ───────────────────────────────────
  // Wave 1: Signature runs first — it owns the iconic, must-do experiences.
  // Wave 2: All other themes run in parallel, with Signature's experiences
  //         passed as a blocklist so they can't repeat the same locations.

  // "signature" is always applicable — force it in if the LLM omitted it
  const rawApplicable = destContext.applicable_themes.filter(id => THEME_NAMES[id])
  const applicableThemes = rawApplicable.includes("signature")
    ? rawApplicable
    : ["signature", ...rawApplicable]
  const sysPrompt = themeSystemPrompt()

  // Wave 1 — Signature
  let signatureTheme: Theme | null = null
  if (applicableThemes.includes("signature")) {
    try {
      const raw = await callLLM(
        sysPrompt,
        themeUserPrompt("signature", dest, destContext, weatherContext, enrichedPrefs),
        provider
      )
      signatureTheme = parseJSON<Theme>(raw)
    } catch (err) {
      console.warn("[/api/generate] signature theme failed:", err)
    }
  }

  const usedExperiences = signatureTheme?.experiences.map(e => ({
    name: e.name,
    location_hint: e.location_hint,
  })) ?? []

  // Wave 2 — all other themes in parallel, with Signature's blocklist
  const remainingThemes = applicableThemes.filter(id => id !== "signature")

  const wave2Results = await Promise.allSettled(
    remainingThemes.map(themeId =>
      callLLM(
        sysPrompt,
        themeUserPrompt(themeId, dest, destContext, weatherContext, enrichedPrefs, usedExperiences),
        provider
      ).then(raw => parseJSON<Theme>(raw))
    )
  )

  // Merge: Signature first, then Wave 2 results
  const rawThemes: Array<{ theme: Theme; themeId: string }> = []
  if (signatureTheme) rawThemes.push({ theme: signatureTheme, themeId: "signature" })
  wave2Results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      rawThemes.push({ theme: result.value, themeId: remainingThemes[i] })
    } else {
      console.warn(`[/api/generate] theme "${remainingThemes[i]}" failed:`, result.reason)
    }
  })

  // Server-side dedup: exact name match — last line of defense against LLM repeats
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
    if (deduped.length > 0) {
      themes.push({ ...theme, experiences: deduped })
    }
  })

  // ── Node 4: Tip enhancement pass — rewrite local_tip for every experience ──
  // Runs in parallel across all experiences. Falls back to original tip on error.
  const tipSysPrompt = tipEnhancementSystemPrompt()
  const enhancedThemes: Theme[] = await Promise.all(
    themes.map(async theme => {
      const enhancedExperiences = await Promise.all(
        theme.experiences.map(async exp => {
          try {
            const enhanced = await callLLM(
              tipSysPrompt,
              tipEnhancementUserPrompt(
                exp.name,
                exp.location_hint ?? dest,
                dest,
                theme.name,
                exp.local_tip
              ),
              provider
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

  const board: Board = {
    destination: dest,
    destination_context: destContext,
    weather_context: weatherContext,
    themes: enhancedThemes,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json({ board })
}
