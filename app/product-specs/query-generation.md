# Module: Query Generation

## What it does

Generates targeted web search queries that will surface real, verifiable travel experiences for a destination — covering every applicable experience theme with enough depth to catch both famous experiences and underrepresented ones (accessible trails, local restaurants, off-season considerations).

The quality of every downstream module depends on this step. Bad queries → irrelevant search results → missing experiences → hallucinated board cards.

## Inputs

- Destination name
- Applicable themes list (from destination context)

## Outputs

- A list of search query strings (typically 25–35 for a destination with 8 applicable themes)

## Query design

For each applicable theme, generate **3 queries**:
1. **Broad** — surfaces overview pages, AllTrails, NPS, listicles with real named experiences
2. **Depth** — targets a specific named experience, trail, or restaurant with a factual qualifier (distance, permit, hours, price)
3. **Corner case** — accessibility/stroller-friendly, family with young kids, off-season conditions, or locals-only picks

Plus **5 fixed cross-cutting queries** for every destination:
- Iconic experience by name with logistics (e.g. "Angels Landing permit distance chains Zion")
- Official trail/park data (NPS or government source)
- Local food near the gateway town (always includes the nearest town name)
- Practical logistics (permits, shuttle, parking, reservations)
- Recent visitor tips (Reddit, trip reports, current year)

## Success criteria

- Every applicable theme has at least 3 dedicated queries
- Food queries include the gateway town name, not just the destination (prevents zero results)
- At least one query targets official/government sources for factual trail data
- The single most iconic experience at the destination has a dedicated query by name
- No two queries return the same set of URLs (no duplicate intent)
- Query count: `(N_themes × 3) + 5` minimum

## Evaluation criteria

- Theme coverage: every applicable theme has at least one query that would surface a representative experience
- Fact-targeting: at least 30% of queries include a fact qualifier (distance, permit, hours, accessible, stroller)
- Source diversity: queries should reach NPS/government, AllTrails, local food blogs, Reddit — not just generic travel sites
- Zero redundancy: no two queries share the same primary intent

## Simplifying assumptions

- Tavily performs best with concise keyword queries (under 12 words) — queries are kept short deliberately
- Gateway town name for food queries is determined by LLM knowledge (not looked up)
- Query count scales linearly with theme count — no diminishing returns modelling

## Open items

- No feedback loop from search results back to query generation — if Tavily returns zero results for a query, queries are not retried or reformulated
- No query for day-trip destinations or regional complements (e.g. Springdale for Zion is captured in food queries but Page, AZ for Grand Canyon is not)
