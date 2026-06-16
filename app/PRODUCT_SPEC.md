# TravelGPT v2 — Product Spec & Implementation Plan

**Last updated:** 2026-05-27 (session 2)  
**Status:** Active development — eval-driven iteration loop

---

## What this is

TravelGPT is an AI travel curator. Given a destination, travel dates, and optional preferences, it produces:
1. A **board** — a curated, themed collection of experiences at the destination with deep local intelligence on each
2. An **itinerary** — a day-by-day schedule built from the board, geographically coherent, timed correctly, paced for real people

It is NOT a booking engine or a search engine. It is the "well-traveled friend" who has already done the research and can hand you a beautiful, opinionated view of what to do and why — with honest tradeoffs, local tips that actually change how you experience a place, and scheduling that accounts for drive times, energy levels, and the realities of family travel.

---

## Core product principles (established by the founder)

1. **De-duplication above all** — one card per underlying experience, ever. 40 tour operators running the same manta ray snorkel = one card.
2. **Specificity over generality** — "Arrive early" is not a tip. If a tip could appear in a guidebook to a different city, it's not good enough.
3. **Party type changes everything, not just ranking** — `family_young` doesn't add "kid-friendly" notes to the same itinerary. It produces a fundamentally different trip.
4. **Under-scheduling is correct for families** — 2–3 activities/day for family_young, not 5.
5. **Food is first-class** — not a restaurant sidebar. A street food crawl or a sake distillery are as valid as any attraction.
6. **Board is universal, itinerary is personal** — experiences at a destination exist regardless of who's traveling. Party type / preferences are filters applied at itinerary planning time, not board generation time. (Established 2026-05-27 — drives the caching architecture.)

---

## Architecture — current state (as of 2026-05-27)

### Board generation pipeline (`/api/generate`)

```
[Stage 1a] Destination context  — soul, pillars, stay area, applicable themes
[Stage 1b] Weather context      — monthly averages, travel implications
           (both served from cache on repeat requests)

[Stage 0.5] Query generation    — 3 queries per applicable theme (broad + depth + corner case)
                                  + 5 cross-cutting queries (iconic, NPS official, local food,
                                  logistics, recent visitor tips)
                                  Total: ~(N_themes × 3) + 5 queries per destination

[Stage 0.6] Tavily search       — parallel, 3 results per query, URL-deduped
                                  raw_content enabled for JS-rendered page fallback

[Stage 0.7a] Page scraping      — fetch each URL ourselves, strip HTML noise
                                  (script/style/nav/footer), return clean article text

[Stage 0.7b] Experience extraction — LLM call over annotated results → GroundedExperience[]
             Cached as experiences.json (90-day TTL)

[Stage 2]  Signature theme generation  (Wave 1 — runs alone, owns iconic experiences)
[Stage 3]  All other themes            (Wave 2 — parallel, receive Signature's blocklist)
           (all theme generation served from board cache on repeat requests)

[Stage 4]  Tip enhancement pass  — per-experience LLM rewrite of local_tip
[Stage 5]  Places enrichment     — Google Places lookup for is_mappable experiences
           (tip enhancement + places enrichment included in board cache)
```

Key implementation decision: **party_type is stripped before board generation**. The board contains all experiences across all tiers. `suitability_tags` and `effort` fields encode access constraints. Party type is applied at itinerary planning time only. This makes the board cache destination-agnostic (no party_type in the key).

### Pipeline layer (`lib/pipeline/`)

All pipeline logic is extracted from route handlers into standalone functions. Route handlers are thin — they call pipeline functions and return responses.

```
lib/pipeline/destination-context.ts   getDestinationContext(dest, provider)
lib/pipeline/weather-context.ts       getWeatherContext(dest, monthLabel, monthSlug, provider)
lib/pipeline/experiences.ts           generateQueries() / annotateResults() / extractExperiences() / getExperiences()
lib/pipeline/board.ts                 generateBoard(dest, destCtx, weatherCtx, experiences, prefs, provider)
lib/utils/parse-json.ts               parseJSON<T>() — shared utility, not duplicated
```

Each pipeline function owns its full contract: check cache → generate if miss → write cache → return data. Nothing outside knows about cache or LLM calls directly.

### Board geography pipeline (`/api/generate`)

```
[Board]    Geographic clustering  — LLM assigns every experience to exactly one
           15–20 min walkable/logical cluster after board cards are created

[Board]    Cluster travel estimates — code generates the cluster pair list;
           LLM fills travel estimates between cluster anchors only
```

### Itinerary planning pipeline (`/api/plan`)

```
[Input]    Uses board.geographic_clusters if present; does not recompute geography

[Stage 3]  Itinerary Pass 1 (draft)  — picks 1–2 clusters/day, honors best_time
           anchors, generates planning_note on every row

[Stage 4]  Itinerary Pass 2 (review)  — 7-check reviewer: party type violations,
           timing, activity stretch, geographic conflicts, departure/arrival
           discipline, planning note quality. Fixes violations, logs change_log[].
```

### Caching layer (`lib/cache/`)

```
cache/destinations/{slug}/
  destination_context.json   ← 180-day TTL
  weather_{month}.json       ← permanent (climate averages)
  experiences.json           ← 90-day TTL (future: search grounding)
  board_{prompt_hash}.json   ← no TTL, invalidates when any .md prompt changes
cache/_index.json            ← registry
```

**Prompt-hash invalidation:** Any edit to a `.md` file in `prompts/` changes the hash → next request regenerates the board and writes a new cache entry. Old board files can be pruned via `DELETE /api/cache?destination=X`.

---

## Planned work — ordered by priority

### P0 — Search grounding ✅ IMPLEMENTED (2026-05-27, extended session 2)

**Problem:** The board is 100% from LLM weights. LLM knows what gets written about most — not what's best for a given traveler. Pa'rus Trail (the #1 family-friendly trail in Zion) is missing from boards because travel magazines don't write about it. Hallucinated experiences (e.g. "Cerulean Forest Reflection Pool" — a completely fictional Zion location) are scheduled in itineraries.

**Implementation:**
```
[Stage 0.5] Query generation    — 3 queries per theme × N applicable themes
                                  + 5 cross-cutting queries
                                  e.g. Zion (8 themes) → 29 queries

[Stage 0.6] Tavily search       — parallel, 3 results/query, URL-deduped
                                  raw_content=true for JS-rendered page fallback

[Stage 0.7a] Page scraping      — our own fetch() + HTML stripping per URL
                                  (script/style/nav/footer removed, 4000 char cap)
                                  Three-tier content selection per result:
                                    1. Our scraped text (best quality)
                                    2. Tavily raw_content (guards: not base64, >40% readable chars)
                                    3. Tavily snippet (always prepended — catches restaurant names
                                       from aggregator pages even when full page is blocked)

[Stage 0.7b] Experience extraction — LLM over annotated results → GroundedExperience[]

[Stage 1] Board generation  — receives "Known verified experiences" block
```

**Caching:** `experiences.json` per destination (90-day TTL). Batch-prefetchable.

**Query design (updated session 2):** Originally 6–8 flat queries. Now 3 per theme (broad + depth + corner case) + 5 cross-cutting. Rationale: 8 flat queries left adventure/nature/romantic/seasonal themes with no dedicated query, producing thin coverage in those themes.

**Tavily API:** $0.01/search. Zion: 29 queries = $0.29 per fresh grounding run. Cached → $0.

**Files created/modified:**
- `prompts/query-generator.md` ✅ — 3-per-theme design with cross-cutting queries
- `prompts/experience-extractor.md` ✅ — extracts verified `GroundedExperience[]`
- `lib/tavily/client.ts` ✅ — thin HTTP wrapper, single + batch search, URL dedup
- `lib/scraper/client.ts` ✅ — fetch + HTML strip (created session 2)
- `lib/pipeline/experiences.ts` ✅ — generateQueries / annotateResults / extractExperiences / getExperiences
- `lib/types.ts` ✅ — `GroundedExperience` type added

**Caching behavior:**
- `experiences.json` cache hit → skip Stages 0.5–0.7 entirely (90-day TTL)
- Board cache hit → skip all theme generation (prompt-hash invalidated)
- Search grounding is non-fatal — any failure returns [] and board continues with LLM-only

### P1 — Tiered coverage (partially done)

**Problem:** Boards lack coverage across difficulty/duration tiers. For family_young destinations, the board generates famous hikes (Angels Landing) but not accessible alternatives (Pa'rus Trail).

**Done (2026-05-27):** Added Coverage Tiers section to 5 theme prompts:
- `hiking.md` — Tier 1 (≤1mi paved), Tier 2 (1–3mi easy), Tier 3 (4–7mi moderate), Tier 4 (8mi+ strenuous)
- `nature.md` — drive-to, accessible walk, short nature walk, scenic hike
- `adventure.md` — beginner, intermediate, expert
- `food_drink.md` — quick/casual, sit-down, immersive
- `culture.md` — brief stop, short visit, half-day deep dive
- `signature.md` — party-type lens: family_young must have paved walk + drive-to + indoor card

**Not done yet:**
- `unique_local.md` — no tiers yet
- `day_trips.md` — no tiers yet
- Eval validation that tiers are actually being generated (run Zion eval after next board generation)

### P2 — Planning notes quality

**Problem:** `planning_note` fields are filled with generic activity descriptions ("A gentle start with this stroller-friendly walk") instead of scheduling reasoning ("Starting here because it's the only paved trail after a 14:00 arrival — energy budget for day 1 is limited").

**Done (2026-05-27):** Updated `itinerary.md` with explicit BAD/GOOD examples and a "detach test" (if this note could appear in a guidebook to a different city, rewrite it).

**Not yet validated** — need to run eval after a fresh board generation to confirm improvement.

### P3 — Regional circuit awareness

**Problem:** Querying "Grand Canyon National Park, South Rim" generates 6 days of South Rim content. The human's golden itinerary spent 3 of 7 days in Page, AZ (Horseshoe Bend, Antelope Canyon, Lake Powell) — which makes the trip special. The AI never discovers this regional context.

**Proposed solution:** Add `regional_complements` field to `DestinationContext`:
```json
"regional_complements": [
  "Page, AZ — Horseshoe Bend, Antelope Canyon, Lake Powell (3–4 hrs drive)",
  "Sedona, AZ — red rock formations, vortex sites (2 hrs drive)"
]
```
The itinerary planner receives these and can allocate days to day trips or suggest a multi-base trip.

**Files to modify:**
- `prompts/destination-context.md` — add regional_complements field
- `lib/types.ts` — add to `DestinationContext` interface
- `prompts/itinerary.md` — use regional_complements in day planning

### P4 — Hallucination guard on board generation

**Problem:** See ISSUE-001 in KNOWN_ISSUES.md. Board generates fictional experiences with real-sounding names.

**Proposed solution (two options, pick one):**
1. **Post-generation self-critique:** After themes are generated, one LLM call: "For each experience, is this a real, verifiable named place? Flag any you are not certain about." Remove flagged experiences.
2. **Search grounding (P0):** When search grounding is implemented, the experience extractor produces a verified list. Board generation is constrained to that list → hallucinations eliminated at source.

P0 is the better long-term fix and handles this automatically.

### P0.1 — Eval reliability ✅ RESOLVED (2026-05-27)

**Problem:** LLM-as-judge eval has ~14-point swing on identical or near-identical inputs. The judge makes factually wrong claims (says Angels Landing is in itinerary when it isn't, says 3 activities/day when there are 2). This makes it impossible to know if a prompt change helped or if we're seeing noise.

**Evidence:** Zion runs 5–7 scored 42, 56, 48 on structurally identical itineraries. The same eval rubric claims different dimensions pass/fail across runs.

**Root cause:** The eval prompt asks the LLM to count, compare, and assess simultaneously. Under token pressure it hallucinates what it expects to see rather than what's in the itinerary.

**Solution implemented:** Three atomic evaluators, each checking exactly one pipeline stage.

```
[Stage 0.7 output]  →  eval-grounding.ts  →  grounding_score.json
[Board output]      →  eval-board.ts      →  board_score.json  
[Itinerary output]  →  eval-itinerary.ts  →  itinerary_score.json
```

**`eval-grounding.ts`** — checks search results quality:
- Deterministic: required experiences found, no hallucinations, category coverage, min count
- LLM (sample): are key_facts actually factual?
- Weighting: 70% deterministic / 30% quality

**`eval-board.ts`** — checks board generation quality:
- Deterministic: required/forbidden on board, tier coverage per theme, deduplication, mappability
- LLM (5 tips sampled): specificity vs. generic clichés
- Weighting: 70% deterministic / 30% quality

**`eval-itinerary.ts`** — two-pass itinerary eval:
- Pass A (deterministic): activity count per day, timing violations, forbidden/required experience presence, shuttle rows, departure day discipline. Outputs structured fact sheet.
- Pass B (LLM judgment): receives the extracted facts as ground truth (cannot hallucinate). Judges planning note quality, flexibility notes, day flow narrative, regional awareness.
- Weighting: 65% deterministic / 35% quality

**Golden file extension:** Each golden file now has a `specs` block with machine-readable constraints for all three evals (required/forbidden experience names, max activities per day, shuttle required, timing cutoffs, etc.)

**Results on Zion:** Single-shot eval had 14-point variance (42–56). New eval:
- Grounding: 73/100 (Riverside Walk missing, key_facts too vague)
- Board: 78/100 (tip quality 86/100, all required experiences present)
- Itinerary: 89/100 (deterministic 100/100, quality 69/100 — flexibility notes thin)

Zero variance on deterministic checks — they're boolean. LLM judgment now bounded by pre-extracted facts.

### P5 — Score ceiling at ~62

**Problem:** Eval scores stuck at 60–65/100 across all destinations. Persistent failures: timing not honored, recovery time ignored.

**Root cause:** The planner is asked to do creative scheduling AND enforce constraints simultaneously. Under token pressure, constraints get dropped.

**Proposed solution:** Add a "constraint pre-pass" before Pass 1:
```
[Stage 2.5] Anchor extraction  — LLM lists all time-locked experiences with
            their required scheduling window BEFORE building the day schedule.
            Output: [{experience_id, must_start_at, reason}]
```
Pass 1 receives this anchor list and builds the schedule around it, not alongside it.

**Files to modify:**
- `app/api/plan/route.ts` — add Stage 2.5
- `prompts/anchor-extraction.md` — new
- `lib/claude/prompts.ts` — add `anchorExtractionUserPrompt()`

---

## Eval infrastructure

### Score history

> **Note:** Runs 1–7 used the old single-shot eval (high LLM variance, ±14pt). Runs 8+ use the new atomic eval system (deterministic + bounded LLM).

| Destination | Run | Score | Eval type | Key failure |
|---|---|---|---|---|
| Yellowstone | 1 | 55 | single-shot | Timing not honored, recovery time 0 |
| Yellowstone | 2 | 62 | single-shot | Grand Prismatic tip missing from notes |
| Yellowstone | 3 | 61 | single-shot | Slight regression |
| Yellowstone | 4 | 55 | single-shot | Prompt over-correction |
| Kyoto | 1 | 62 | single-shot | Evening anchors wrong, recovery time 0 |
| Grand Canyon | 1 | 62 | single-shot | Regional Page/canyon country circuit missed entirely |
| Zion (no prefs) | 1 | 48 | single-shot | Angels Landing scheduled for family_young 🔴 |
| Zion (family_young) | 2 | 55 | single-shot | party_type fix; shuttle + density still failing |
| Zion (family_young) | 3 | 56 | single-shot | 4-stage pipeline; planning notes still generic |
| Zion (family_young) | 4 | 56 | single-shot | Pass 2 sharpened; tiered prompts not yet re-evaluated |
| Zion (family_young) | 5–7 | 42–56 | single-shot | High variance — eval reliability problem identified |
| Zion grounding | 8 | 73 | **atomic** | Riverside Walk not found; key_facts too vague |
| Zion board | 8 | 78 | **atomic** | All required present; tip quality 86/100 |
| Zion itinerary | 8 | 89 | **atomic** | Deterministic 100/100; flexibility notes thin (60/100) |

### Golden files
- `golden/yellowstone_may2026.json` — 7-day Yellowstone, active adults
- `golden/kyoto_april2026.json` — 5-day Kyoto, couple
- `golden/grand_canyon_oct2026.json` — 7-day regional canyon country circuit
- `golden/zion_nov2026.json` — 5-day Zion, family with toddler (family_young)

### How to run an eval
```bash
npm run dev  # must be running
bash scripts/plan.sh <board_json_file>
npx tsx scripts/eval.ts <itinerary_json> <golden_json>
```

---

## Key decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05 | Two-wave board generation | Signature theme runs solo first to claim iconic experiences; other themes receive its blocklist to prevent duplication |
| 2026-05 | Tip enhancement pass | LLM-generated tips are too generic; a focused rewriter produces hyper-specific local intel |
| 2026-05 | AssumptionsBar with stay area edit | User needs to override recommended stay area; triggers replan |
| 2026-05-27 | 4-stage planning pipeline | Single-pass planner drops constraints under token pressure; separating cluster → draft → review produces better schedules |
| 2026-05-27 | planning_note on every row | User-facing reasoning for why each activity is when it is — separates plans people trust from lists they second-guess |
| 2026-05-27 | Party type stripped from board generation | Board is universal (experiences exist regardless of traveler); party_type applied only at itinerary planning. Enables destination-level cache with no party_type in key |
| 2026-05-27 | File-based cache with prompt-hash invalidation | LLM calls are expensive ($0.08–0.20/board) and slow (90–120s); same destination in dev hits the API dozens of times. Prompt-hash key auto-invalidates stale boards when prompts change |
| 2026-05-27 | Tiered coverage in theme prompts | LLM generates what gets written about most (famous strenuous hikes) not what's most useful for all travelers (accessible Tier 1 options). Structured tiers force coverage across difficulty levels |
| 2026-05-27 | Tavily for search grounding | $0.01/search, returns clean structured text for LLM consumption, no HTML parsing needed. Alternative: Serper (better Google quality for obscure queries) |
| 2026-05-27 | Search grounding is non-fatal | Tavily failure or extractor failure falls back to pure LLM generation. Board quality degrades gracefully rather than failing the request entirely. |
| 2026-05-27 | Experiences cache is prompt-hash-independent | `experiences.json` uses a 90-day TTL, not prompt-hash invalidation. Real-world experiences don't change when prompts change. Only the board (which interprets the experiences) is prompt-hash invalidated. |
| 2026-05-27 | 800-char snippet cap in extractor | Tavily returns up to 400 chars by default; we allow up to 800 chars per result to give the extractor enough context, but cap it to avoid token blowout on the experience extraction call. |
| session 2 | Pipeline layer extracted from route handler | All pipeline logic moved from `app/api/generate/route.ts` (420 lines) into `lib/pipeline/` functions. Route is now ~80 lines. Rationale: inline logic in route handlers cannot be tested in isolation; the audit script was a broken parallel reimplementation. Now both route and audit script call the same functions. |
| session 2 | Query generator redesigned: 3 per theme | Changed from 6–8 flat queries to 3 queries per applicable theme (broad + depth + corner case) + 5 fixed cross-cutting queries. Zion: 8 themes → 29 queries. Rationale: flat queries left multiple themes with no dedicated coverage; board quality in those themes was thin. |
| session 2 | step-audit.ts calls production pipeline functions | Audit script no longer has its own LLM calls or cache logic. It calls `getDestinationContext`, `getWeatherContext`, `generateQueries`, `annotateResults`, `extractExperiences` — the same functions the route uses. Cache behaviour is identical to production. |
| session 2 | parseJSON extracted to lib/utils/ | Duplicate function existed in generate/route.ts and plan/route.ts. Single source in `lib/utils/parse-json.ts`, imported by all pipeline files. |

---

## File map (quick reference)

```
app/api/generate/route.ts     Thin: calls pipeline functions, returns Board (~80 lines)
app/api/plan/route.ts         Itinerary pipeline — inline (refactor to lib/pipeline/ pending)
app/api/enrich/route.ts       Places enrichment endpoint (client-side trigger)
app/api/cache/route.ts        Cache status / prune API

lib/pipeline/                 ← All board pipeline logic lives here
  destination-context.ts      getDestinationContext(dest, provider)
  weather-context.ts          getWeatherContext(dest, monthLabel, monthSlug, provider)
  experiences.ts              generateQueries / annotateResults / extractExperiences / getExperiences
  board.ts                    generateBoard(dest, destCtx, weatherCtx, experiences, prefs, provider)

lib/utils/parse-json.ts       Shared parseJSON<T>() — single source of truth
lib/types.ts                  All TypeScript interfaces
lib/claude/prompts.ts         Prompt builders (assembles .md + data)
lib/llm/client.ts             callLLM() — provider routing + stage-based model selection
lib/cache/index.ts            File cache — cacheRead / cacheWrite / boardCacheKey / TTL
lib/tavily/client.ts          tavilySearch / tavilyBatchSearch (URL-deduped)
lib/scraper/client.ts         scrapeUrl / scrapeUrls — fetch + HTML strip
lib/places/client.ts          enrichExperience — Google Places Text Search + Details

prompts/query-generator.md    3 queries per theme + 5 cross-cutting
prompts/experience-extractor.md
prompts/destination-context.md
prompts/weather-context.md
prompts/system.md             Board card schema + quality rules
prompts/themes/*.md           Per-theme generation instructions (12 themes)
prompts/distance-cluster.md  Stage 2 clustering
prompts/itinerary.md          Stage 3 Pass 1 draft planner
prompts/itinerary-review.md  Stage 4 Pass 2 reviewer

scripts/step-audit.ts         ← Step-by-step pipeline inspector (calls production pipeline fns)
scripts/prefetch.ts           Batch cache warmer (calls /api/generate HTTP)
scripts/eval-grounding.ts     Atomic eval — search grounding (deterministic)
scripts/eval-board.ts         Atomic eval — board quality (deterministic + LLM)
scripts/eval-itinerary.ts     Atomic eval — itinerary quality (two-pass)
scripts/eval.ts               Legacy single-shot eval (high variance — use atomic evals)
scripts/generate.sh           CLI: generate board → test_outputs/
scripts/plan.sh               CLI: generate itinerary from board file

golden/*.json                 Human reference itineraries + eval rubrics
cache/destinations/           File cache (gitignored except .gitkeep)
AGENTS.md                     Agent operating rules — READ THIS FIRST
PRODUCT_SPEC.md               Product spec + architecture + decisions log (this file)
KNOWN_ISSUES.md               Tracked issues with fix specs
```

---

## Open cost/infra items

| Item | Status | Notes |
|---|---|---|
| **Explore DeepSeek V3 and Qwen2.5-72B as board-generation providers** | Open | Both are open-weights models that benchmark near GPT-4o on structured JSON tasks at 85–90% lower cost. DeepSeek V3: $0.27/$1.10 per 1M tokens via Together AI (Western infra, no China data residency concern). Run head-to-head eval: generate Zion board with DeepSeek V3, score with eval-board.ts, compare. If passes, drop GPT-4o for board gen too. |
| **Gemini 2.5 Flash for cheap stages** | ✅ IMPLEMENTED (session 2) | Query generator, experience extractor, tip enhancement, destination context, weather context all run on Gemini 2.5 Flash. Note: `gemini-2.0-flash` is deprecated for new users — correct model is `gemini-2.5-flash`. Board generation stays on GPT-4o until validated. Per-destination cost: ~$0.25–0.35 vs ~$1.20 previously. |
| **Self-hosted inference (Ollama / vLLM)** | Parked | Worth revisiting at scale. Needs dedicated GPU infra. Not viable for on-demand API route; would require async job queue. |

---

## What still needs a spec (not yet designed)

- **UI for planning_note display** — where does the reasoning appear in the itinerary view? Tooltip, expandable row, or always-visible?
- **Board freshness indicator** — show the user when a board was generated from cache vs. live
- **Preference persistence** — user sets party_type once, persists across sessions
- **Multi-destination trips** — "I want to do Grand Canyon + Page + Sedona in 10 days"
- **User accounts / saved itineraries**
- **Mobile UI**
