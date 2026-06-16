import { NextRequest, NextResponse } from "next/server"
import {
  ErrorResponse,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackSentiment,
  FeedbackSurface,
} from "@/lib/types"
import { recordFeedback } from "@/lib/feedback"

const SENTIMENTS: FeedbackSentiment[] = ["positive", "negative", "correction", "missing", "other"]
const SURFACES: FeedbackSurface[] = ["board", "card", "detail"]
const MAX_MESSAGE_LENGTH = 2000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Validate the feedback payload shape before persisting it.
 *
 * Returns a normalized request with trimmed message text.
 * Does not validate every nested context field deeply; the UI owns context assembly.
 */
function parseFeedbackPayload(body: unknown): FeedbackRequest | NextResponse<ErrorResponse> {
  if (!isRecord(body)) return invalid("Invalid JSON body")

  const sentiment = body.sentiment
  if (typeof sentiment !== "string" || !SENTIMENTS.includes(sentiment as FeedbackSentiment)) {
    return invalid("sentiment is invalid")
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (message.length < 2) return invalid("message is required")
  if (message.length > MAX_MESSAGE_LENGTH) return invalid(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)

  const context = body.context
  if (!isRecord(context)) return invalid("context is required")

  const surface = context.surface
  if (typeof surface !== "string" || !SURFACES.includes(surface as FeedbackSurface)) {
    return invalid("context.surface is invalid")
  }

  if (!isRecord(context.board)) return invalid("context.board is required")
  if ((surface === "card" || surface === "detail") && !isRecord(context.card)) {
    return invalid("context.card is required for card feedback")
  }

  return {
    sentiment: sentiment as FeedbackSentiment,
    message,
    context: context as unknown as FeedbackRequest["context"],
  }
}

/**
 * Record anonymous user feedback for board and card surfaces.
 *
 * Returns the persisted feedback record on success, or a scoped error response
 * without affecting the board experience.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<FeedbackResponse | ErrorResponse>> {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = parseFeedbackPayload(body)
  if (parsed instanceof NextResponse) return parsed

  try {
    const feedback = recordFeedback(parsed)
    return NextResponse.json({ feedback }, { status: 201 })
  } catch (err) {
    console.error("[/api/feedback] write failed:", err)
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 })
  }
}
