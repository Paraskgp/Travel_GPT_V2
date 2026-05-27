import { NextRequest, NextResponse } from "next/server"
import { callLLM, Provider } from "@/lib/llm/client"
import { itinerarySystemPrompt, itineraryUserPrompt } from "@/lib/claude/prompts"
import { PlanRequest, PlanResponse, Itinerary, ErrorResponse } from "@/lib/types"

export const maxDuration = 180

function parseJSON<T>(raw: string): T {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  return JSON.parse(stripped) as T
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<PlanResponse | ErrorResponse>> {
  let body: PlanRequest & { provider?: Provider }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const {
    board,
    start_date,
    end_date,
    arrival_time,
    departure_time,
    stay_area,
    forced_ids = [],
    skipped_ids = [],
    provider = "openai",
  } = body

  if (!board || !start_date || !end_date) {
    return NextResponse.json({ error: "board, start_date, and end_date are required" }, { status: 400 })
  }

  try {
    const raw = await callLLM(
      itinerarySystemPrompt(),
      itineraryUserPrompt(board, start_date, end_date, arrival_time, departure_time, stay_area, forced_ids, skipped_ids),
      provider
    )
    const itinerary = parseJSON<Itinerary>(raw)
    return NextResponse.json({ itinerary })
  } catch (err) {
    console.error("[/api/plan] failed:", err)
    return NextResponse.json({ error: "Failed to generate itinerary" }, { status: 500 })
  }
}
