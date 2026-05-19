import { NextRequest, NextResponse } from "next/server"
import { callLLM, Provider } from "@/lib/llm/client"
import {
  destinationContextSystemPrompt,
  destinationContextUserPrompt,
  weatherContextSystemPrompt,
  weatherContextUserPrompt,
  themeSystemPrompt,
  themeUserPrompt,
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

  const { destination, month, dates, preferences, provider = "openai" } = body

  if (!destination?.trim()) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 })
  }

  const dest = destination.trim()
  const travelMonth = dates ?? month ?? null

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
        themeUserPrompt("signature", dest, destContext, weatherContext, preferences),
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
        themeUserPrompt(themeId, dest, destContext, weatherContext, preferences, usedExperiences),
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

  const board: Board = {
    destination: dest,
    destination_context: destContext,
    weather_context: weatherContext,
    themes,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json({ board })
}
