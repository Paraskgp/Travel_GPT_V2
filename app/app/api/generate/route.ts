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

  // ── Node 3+: Fan out to theme calls in parallel ───────────────────────────
  const applicableThemes = destContext.applicable_themes.filter(id => THEME_NAMES[id])

  const themeResults = await Promise.allSettled(
    applicableThemes.map(themeId =>
      callLLM(
        themeSystemPrompt(),
        themeUserPrompt(themeId, dest, destContext, weatherContext, preferences),
        provider
      ).then(raw => parseJSON<Theme>(raw))
    )
  )

  const themes: Theme[] = []
  themeResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      themes.push(result.value)
    } else {
      console.warn(`[/api/generate] theme "${applicableThemes[i]}" failed:`, result.reason)
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
