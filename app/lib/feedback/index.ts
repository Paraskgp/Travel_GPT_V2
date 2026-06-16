import fs from "fs"
import path from "path"
import crypto from "crypto"
import { FeedbackRecord, FeedbackRequest } from "@/lib/types"

const FEEDBACK_DIR = path.join(process.cwd(), "feedback")
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, "feedback.jsonl")

/**
 * Persist a feedback request as an append-only JSONL record.
 *
 * Returns the stored record with a server-generated id and timestamp.
 * Throws if the directory cannot be created or the record cannot be written.
 */
export function recordFeedback(request: FeedbackRequest): FeedbackRecord {
  if (!fs.existsSync(FEEDBACK_DIR)) fs.mkdirSync(FEEDBACK_DIR, { recursive: true })

  const record: FeedbackRecord = {
    ...request,
    id: crypto.randomUUID(),
    received_at: new Date().toISOString(),
    schema_version: 1,
  }

  fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(record) + "\n", "utf-8")
  return record
}
