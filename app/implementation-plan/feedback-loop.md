# Implementation Plan — Feedback Loop

**Last updated:** 2026-06-16

---

## Owns

- `components/feedback/FeedbackButton.tsx` — reusable client feedback control.
- `app/api/feedback/route.ts` — HTTP entrypoint for feedback writes.
- `lib/feedback/index.ts` — file-backed feedback persistence boundary.
- `lib/types.ts` — feedback request, context, and persisted record types.
- `app/app/page.tsx`, `components/board/ThemeSection.tsx`, `components/board/ExperienceCard.tsx`, `components/board/ExperienceDetail.tsx` — pass context into feedback controls.

## Inputs / Outputs

```ts
export interface FeedbackRequest {
  sentiment: "positive" | "negative" | "correction" | "missing" | "other"
  message: string
  context: FeedbackContext
}

export interface FeedbackResponse {
  feedback: FeedbackRecord
}
```

`FeedbackContext` contains a compact board context and optional card context. `FeedbackRecord` adds a server-generated `id`, `received_at`, and `schema_version`.

## Steps

1. UI renders a compact feedback button on the board header, every card, and the detail drawer.
2. User opens the feedback popover, chooses a sentiment, writes a note, and submits.
3. Client POSTs `FeedbackRequest` to `/api/feedback`.
4. Route validates sentiment, message length, and context scope.
5. Route calls `recordFeedback()` in `lib/feedback`.
6. `recordFeedback()` writes an append-only JSONL record to `feedback/feedback.jsonl`.
7. UI shows success or scoped error state.

## Caching

None. Feedback is append-only user input and must not be cached.

## Failure handling

- Invalid input is fatal for the feedback request and returns `400`.
- File write failure returns `500` from `/api/feedback`.
- UI failures are local to the feedback control and must not alter board, itinerary, card, or detail state.

## Unit tests

- Open item: add API route tests once a route test harness exists.
- Open item: add `recordFeedback()` unit tests with a temporary directory override.
- Manual verification for this implementation: TypeScript compile plus API POST smoke test.

## Open technical items

- 2026-06-16: Replace local JSONL storage with durable persistence before production multi-instance deployment.
- 2026-06-16: Add server-side redaction if future feedback context starts including user identity or raw provider fields.
- 2026-06-16: Add review/export scripts for agent analysis of accumulated feedback.
