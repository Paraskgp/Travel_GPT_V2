# Feedback Loop

**Last updated:** 2026-06-16

---

## What it does

The feedback loop lets a traveler leave structured feedback on an individual experience card, the open card detail view, or the board as a whole. Each feedback item records enough product context for agents and humans to understand what the user saw and why it mattered, without storing the full board or raw provider payloads.

## Inputs

- A user-entered feedback note.
- An optional sentiment: positive, negative, correction, missing, or other.
- The UI surface where feedback was submitted: board, card, or detail drawer.
- The current board context: destination, dates, preferences, generated timestamp, and active tab.
- For card-level feedback, the visible card fields and lightweight enrichment summary.
- For itinerary-adjacent feedback, current include/skip/force state when available.

## Outputs

- A persisted feedback record with a stable ID and server timestamp.
- A compact context snapshot that agents can inspect later to identify useful product, prompt, data, or UI improvements.
- A client acknowledgement so the UI can show the user that feedback was recorded.

## Success criteria

- Feedback can be submitted from a board-level control.
- Feedback can be submitted from an individual experience card without opening the detail drawer.
- Feedback can be submitted from the experience detail drawer.
- Card feedback includes the card's visible text, theme identifier/name, destination, travel dates, preferences, and generated board timestamp.
- Board feedback includes board identifier context and high-level counts, not the full card list.
- Stored records do not include raw Google Places responses or complete board JSON.
- A failed feedback write does not break the travel board; the user sees a scoped failure message.

## Evaluation criteria

- **Actionability:** an agent can tell what the user reacted to without reconstructing the entire session.
- **Signal density:** records preserve visible copy, user input, and high-level generation context while excluding noisy raw provider data.
- **Low friction:** feedback is available where the user is evaluating quality, but does not dominate browsing or itinerary controls.
- **Operational simplicity:** local development stores records without external services; the storage boundary can be replaced by a database later.

## Simplifying assumptions

- Feedback is anonymous for now; no user account or identity field is required.
- Local file storage is acceptable during current development and eval workflows.
- Users submit free-form text rather than a multi-step survey.
- Screenshots, browser metadata, and full clickstream replay are out of scope.

## Open items

- 2026-06-16: Decide the long-term persistence target before production use: database table, event stream, or analytics warehouse.
- 2026-06-16: Define the agent workflow that classifies feedback into prompt issue, data issue, UI issue, itinerary issue, or non-actionable.
- 2026-06-16: Add an authenticated admin review surface once user accounts exist.
