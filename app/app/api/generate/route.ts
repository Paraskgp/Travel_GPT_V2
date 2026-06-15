import { NextRequest, NextResponse } from "next/server"
import { Provider } from "@/lib/llm/client"
import { Board, GenerateRequest, GenerateResponse, ErrorResponse, Preferences, Theme } from "@/lib/types"
import { normalizeDestination } from "@/lib/pipeline/destination-normalization"
import { getDestinationContext } from "@/lib/pipeline/destination-context"
import { getWeatherContext } from "@/lib/pipeline/weather-context"
import { getExperiences } from "@/lib/pipeline/experiences"
import { generateBoard } from "@/lib/pipeline/board"
import { cacheRead, boardCacheKey } from "@/lib/cache"

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
  let body: GenerateRequest & { provider?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { destination, month, dates, start_date, end_date, preferences, provider: rawProvider = "openai" } = body
  // Normalize provider alias: "claude" is an alias for "anthropic"
  const provider: Provider = (rawProvider as string) === "claude" ? "anthropic" : (rawProvider as Provider)

  if (!destination?.trim()) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 })
  }

  // Normalize raw user input to canonical destination name before anything touches the cache.
  // "Zion" → "Zion National Park", "NYC" → "New York City", misspellings corrected.
  // Non-fatal: falls back to raw input on LLM failure.
  const dest = await normalizeDestination(destination.trim(), provider)

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

  // Short-circuit: if the board is already cached, skip the experiences pipeline entirely.
  // getExperiences can take 10+ minutes on a new month key — running it before the board
  // cache check wastes that time on data that will never be used.
  const bKey = boardCacheKey()
  const cachedBoardData = cacheRead<{ themes: Theme[]; eval_gaps?: string[] }>(dest, bKey)

  let themes: Theme[]
  let eval_gaps: string[]

  if (cachedBoardData) {
    console.log(`[/api/generate] board cache HIT — skipping experiences pipeline`)
    themes = cachedBoardData.themes
    eval_gaps = cachedBoardData.eval_gaps ?? []
  } else {
    // Pass travel month so event-specific queries are added for sports, festivals, etc.
    const travelMonthName = start_date
      ? new Date(start_date + "T00:00:00").toLocaleString("en-US", { month: "long" })
      : null
    const experiences = await getExperiences(dest, destContext, travelMonthName, provider)
    ;({ themes, eval_gaps } = await generateBoard(dest, destContext, weatherContext, experiences, boardPrefs(fullPrefs), provider))
  }

  // ── Response ─────────────────────────────────────────────────────────────────

  const board: Board = {
    destination: dest,
    destination_context: destContext,
    weather_context: weatherContext,
    themes,
    eval_gaps,
    ...(Object.keys(fullPrefs).length > 0 ? { preferences: fullPrefs } : {}),
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json({ board })
}
