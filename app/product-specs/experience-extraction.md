# Module: Experience Extraction

## What it does

Transforms annotated search results into a structured list of verified real-world experiences. This is the hallucination firewall — the output of this module is the "Known verified experiences" block injected into board generation. The board LLM can write rich card descriptions, but it cannot invent place names that are not on this list.

Two jobs in priority order:
1. **Confirm existence** — is this a real, named place? If yes, extract it.
2. **Extract facts** — what specific data (distance, hours, price, accessibility) does the source actually contain?

A verified name with partial facts is better than a missing entry.

## Inputs

- Destination name
- List of annotated results (from search & scraping module)

## Outputs

- A list of `GroundedExperience` objects, each containing:
  - `name` — the real, verifiable name
  - `location` — specific location including state/country and sub-location (e.g. shuttle stop, street address)
  - `category` — trail, restaurant, viewpoint, museum, tour, etc.
  - `key_facts` — 2–4 factual bullets with real data. If data is not in the source, writes "Not found in search results" rather than inventing it.
  - `source_url` — the URL that verified this experience

## Success criteria

- All experiences present in search results are extracted — no false negatives on named, verifiable places
- `location` field is always specific (includes state/country AND a named sub-location where available)
- `key_facts` contains only data found in the source — no invented distances or hours
- Restaurants extracted if name + location known (lower bar than trails — cuisine type or hours count as facts)
- Sub-experiences extracted separately where they have distinct identities (e.g. Riverside Walk extracted separately from The Narrows)
- Target: 10–25 experiences per destination. Fewer means search results were poor; more risks dilution.
- Output is a valid JSON array matching `GroundedExperience[]`

## Evaluation criteria

- **Required experience coverage** — does the output contain the experiences that should be present for this destination? Checked against `golden/[destination].json` `specs.grounding.required` list.
- **Fact quality** — are key_facts genuinely factual (numeric distances, hours, prices) rather than vague marketing copy ("stunning views", "highly recommended")? Scored by sampling 5 experiences and checking each fact.
- **No hallucinations** — experiences in the output must be verifiable from the search results provided, not from LLM training knowledge.
- **Category coverage** — output must contain experiences across at least 3 different categories (trail, restaurant, viewpoint, etc.)

## Simplifying assumptions

- One LLM call processes all annotated results together — enables cross-result deduplication but creates a large input context
- The LLM is trusted to correctly identify whether a name appears in the source text (not verified programmatically)
- Restaurant location is accepted at city/neighborhood level when street address is not available

## Open items

- No programmatic verification that `source_url` actually contains the extracted experience name
- No retry if extraction yields fewer than 10 results — pipeline continues with whatever it gets
- Experiences from LLM training knowledge that don't appear in search results are correctly excluded — but this means lesser-known but real experiences that weren't in search results are also excluded
