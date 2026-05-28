import { NextRequest, NextResponse } from "next/server"
import { Provider } from "@/lib/llm/client"
import { Board, GenerateRequest, GenerateResponse, ErrorResponse, Preferences } from "@/lib/types"
import { getDestinationContext } from "@/lib/pipeline/destination-context"
import { getWeatherContext } from "@/lib/pipeline/weather-context"
import { getExperiences } from "@/lib/pipeline/experiences"
import { generateBoard } from "@/lib/pipeline/board"

export const maxDuration = 180

/**
 * Strip party_type before board generation.
 *
 * The board is a universal representation of a destination — experiences exist
 * regardless of who is traveling. Party type is applied at itinerary planning
 * time only, not during board generation. This keeps the board cache party_type-agnostic.
 */
function boardPrefs(prefs: Preferences): Preferences {
  const { party_type: _dropped, ...rest } = prefs
  return rest
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

  const { destination, month, dates, start_date, end_date, preferences, provider = "openai" } = body

  if (!destination?.trim()) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 })
  }

  const dest = destination.trim()

  // Travel month — used for weather context and cache key
  const travelMonthLabel = start_date
    ? new Date(start_date + "T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })
    : (dates ?? month ?? null)

  const weatherMonthSlug = start_date
    ? new Date(start_date + "T00:00:00").toLocaleString("en-US", { month: "long" }).toLowerCase()
    : (month ?? dates ?? "unknown").toLowerCase().split(" ")[0]

  // Full preferences (including party_type) stored on the board response.
  // party_type is NOT passed into board generation — see boardPrefs().
  let fullPrefs: Preferences = preferences ?? {}
  if (start_date && end_date) {
    const msPerDay = 1000 * 60 * 60 * 24
    const days = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / msPerDay) + 1
    if (days > 0) fullPrefs = { ...fullPrefs, duration_days: days }
  }

  // ── Pipeline ─────────────────────────────────────────────────────────────────

  let destContext
  try {
    destContext = await getDestinationContext(dest, provider)
  } catch (err) {
    console.error("[/api/generate] destination context failed:", err)
    return NextResponse.json({ error: "Failed to generate destination context" }, { status: 500 })
  }

  const weatherContext = await getWeatherContext(dest, travelMonthLabel ?? "unknown", weatherMonthSlug, provider)

  const experiences = await getExperiences(dest, destContext, provider)

  const themes = await generateBoard(dest, destContext, weatherContext, experiences, boardPrefs(fullPrefs), provider)

  // ── Response ─────────────────────────────────────────────────────────────────

  const board: Board = {
    destination: dest,
    destination_context: destContext,
    weather_context: weatherContext,
    themes,
    ...(Object.keys(fullPrefs).length > 0 ? { preferences: fullPrefs } : {}),
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json({ board })
}
