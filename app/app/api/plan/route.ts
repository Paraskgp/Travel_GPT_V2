import { NextRequest, NextResponse } from "next/server"
import { callLLM, Provider } from "@/lib/llm/client"
import {
  clusterSystemPrompt, clusterUserPrompt,
  itinerarySystemPrompt, itineraryUserPrompt,
  reviewSystemPrompt, reviewUserPrompt,
} from "@/lib/claude/prompts"
import { PlanRequest, PlanResponse, Itinerary, ClusterResult, ErrorResponse } from "@/lib/types"

export const maxDuration = 300  // 5 min — 4 sequential LLM calls need headroom

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
    preferences,
    forced_ids = [],
    skipped_ids = [],
    provider = "openai",
  } = body

  if (!board || !start_date || !end_date) {
    return NextResponse.json({ error: "board, start_date, and end_date are required" }, { status: 400 })
  }

  // Merge preferences: request body overrides board-stored preferences
  const resolvedPrefs = { ...(board.preferences ?? {}), ...(preferences ?? {}) }

  // ── Stage 2: Distance matrix + geographic clustering ─────────────────────────
  let clusters: ClusterResult | undefined
  try {
    console.log("[/api/plan] Stage 2: clustering...")
    const clusterRaw = await callLLM(
      clusterSystemPrompt(),
      clusterUserPrompt(board),
      provider
    )
    clusters = parseJSON<ClusterResult>(clusterRaw)
    console.log(`[/api/plan] Stage 2 done: ${clusters.clusters.length} clusters, ${clusters.pairs.length} pairs`)
  } catch (err) {
    // Clustering is best-effort — if it fails, fall through to Pass 1 without clusters
    console.warn("[/api/plan] Stage 2 (clustering) failed — continuing without clusters:", err)
    clusters = undefined
  }

  // ── Stage 3: Itinerary Pass 1 (draft) ────────────────────────────────────────
  let draft: Itinerary
  try {
    console.log("[/api/plan] Stage 3: Pass 1 (draft itinerary)...")
    const pass1Raw = await callLLM(
      itinerarySystemPrompt(),
      itineraryUserPrompt(
        board, start_date, end_date,
        arrival_time, departure_time,
        stay_area, resolvedPrefs,
        forced_ids, skipped_ids,
        clusters
      ),
      provider
    )
    draft = parseJSON<Itinerary>(pass1Raw)
    console.log(`[/api/plan] Stage 3 done: ${draft.days.length} days`)
  } catch (err) {
    console.error("[/api/plan] Stage 3 (Pass 1) failed:", err)
    return NextResponse.json({ error: "Failed to generate itinerary" }, { status: 500 })
  }

  // ── Stage 4: Itinerary Pass 2 (review + refine) ───────────────────────────────
  let itinerary: Itinerary
  try {
    console.log("[/api/plan] Stage 4: Pass 2 (review + refine)...")
    const pass2Raw = await callLLM(
      reviewSystemPrompt(),
      reviewUserPrompt(draft, board, clusters ?? { pairs: [], clusters: [] }, resolvedPrefs),
      provider
    )
    itinerary = parseJSON<Itinerary>(pass2Raw)
    console.log(`[/api/plan] Stage 4 done. Changes: ${itinerary.change_log?.length ?? 0}`)
    if (itinerary.change_log?.length) {
      console.log("[/api/plan] Change log:", itinerary.change_log)
    }
  } catch (err) {
    // Pass 2 failure is non-fatal — return the Pass 1 draft
    console.warn("[/api/plan] Stage 4 (Pass 2 review) failed — returning Pass 1 draft:", err)
    itinerary = { ...draft, change_log: ["Pass 2 review skipped — returned Pass 1 draft."] }
  }

  return NextResponse.json({ itinerary, clusters })
}
