# TravelGPT v2

An AI travel curator that generates curated destination boards and day-by-day itineraries. Built with Next.js, TypeScript, OpenAI GPT-4o.

---

## Quick start

```bash
npm install
# Add OPENAI_API_KEY to .env.local
npm run dev       # → http://localhost:3000
```

---

## What this does

1. User enters a destination, dates, and optional preferences (party type, dietary, interests)
2. **Board generation** — multi-theme experience cards with local tips, best times, effort ratings
3. **Itinerary planning** — 4-stage pipeline: cluster → Pass 1 draft → Pass 2 review → final itinerary
4. UI renders the board (browsable by theme) and the day-by-day itinerary side by side

---

## Architecture — 4-stage planning pipeline

```
User input
    ↓
[Stage 1] Board generation  (app/api/generate)
    → Destination context + weather context (parallel)
    → Signature theme (solo, blocks duplicates)
    → All other themes (parallel)
    → Tip enhancement pass (parallel per experience)
    → Returns: Board JSON with 5–8 themes, 25–40 experience cards

[Stage 2] Distance matrix + clustering  (app/api/plan — first step)
    → Single LLM call: estimates travel times between all experience pairs
    → Groups experiences into geographic clusters (≤15 min walk = same cluster)
    → Returns: ClusterResult {pairs[], clusters[]}

[Stage 3] Itinerary draft — Pass 1  (app/api/plan)
    → Receives clusters, party_type, dates, forced/skipped ids
    → Picks 1–2 clusters per day, honors best_time anchors
    → Every activity row gets a planning_note explaining why
    → Returns: draft Itinerary JSON

[Stage 4] Itinerary review — Pass 2  (app/api/plan)
    → Receives draft + clusters + preferences
    → Runs 7 explicit checks: party type violations, timing, activity stretch,
      geographic conflicts, departure/arrival discipline, planning note quality
    → Fixes violations, logs changes in change_log[]
    → Returns: final Itinerary JSON
```

---

## Key files

### API routes
| File | What it does |
|---|---|
| `app/api/generate/route.ts` | Full board generation pipeline (4 nodes) |
| `app/api/plan/route.ts` | 4-stage itinerary pipeline (cluster + draft + review) |
| `app/api/enrich/route.ts` | Google Places photo enrichment |

### Prompts (all in `prompts/`)
| File | Used in |
|---|---|
| `system.md` | Theme generation — defines the board card schema and quality rules |
| `destination-context.md` | Generates the soul/pillars/stay-area for a destination |
| `weather-context.md` | Generates weather summary for the travel month |
| `themes/*.md` | Per-theme instructions (signature, hiking, food_drink, etc.) |
| `distance-cluster.md` | Stage 2 — generates travel pairs and geographic clusters |
| `itinerary.md` | Stage 3 — Pass 1 draft planner |
| `itinerary-review.md` | Stage 4 — Pass 2 reviewer/fixer |

### Core library
| File | What it does |
|---|---|
| `lib/types.ts` | All TypeScript interfaces (Board, Experience, Itinerary, ClusterResult…) |
| `lib/claude/prompts.ts` | Prompt builders — assembles system + user prompts from .md files + data |
| `lib/llm/client.ts` | OpenAI wrapper with retry/backoff for 429 rate limit errors |

### UI components
| File | What it does |
|---|---|
| `app/page.tsx` | Main page — orchestrates generate + plan calls, holds all state |
| `components/input/InputForm.tsx` | Destination + date + preferences input |
| `components/board/` | Experience cards, theme sections, spirit view, weather table |
| `components/itinerary/ItineraryView.tsx` | Day-by-day itinerary renderer |
| `components/itinerary/AssumptionsBar.tsx` | Stay area display + edit → triggers replan |
| `components/map/MapView.tsx` | Google Maps integration for experience pins |

### Scripts (offline pipeline, for eval/dev)
| File | What it does |
|---|---|
| `scripts/generate.sh` | Calls `/api/generate`, saves board JSON to `test_outputs/` |
| `scripts/plan.sh` | Calls `/api/plan` on a saved board, saves itinerary JSON |
| `scripts/eval.ts` | LLM-as-judge evaluator — scores itinerary against a golden |

### Golden itineraries + evals
| Directory | What it contains |
|---|---|
| `golden/` | Human-authored reference itineraries (JSON) used as eval targets |
| `test_outputs/` | Generated boards + itineraries from script runs |
| `eval_outputs/` | Scored eval reports (markdown + JSON) |

---

## Environment variables

```
OPENAI_API_KEY=sk-...          # Required — used for all LLM calls
GOOGLE_PLACES_API_KEY=...      # Optional — enables photo enrichment and map pins
```

---

## Running offline evals

```bash
# 1. Start the dev server
npm run dev

# 2. Generate a board (saves to test_outputs/)
bash scripts/generate.sh "Kyoto" "2026-04-01" "2026-04-07" "14:00" "10:00"

# 3. Plan an itinerary from the board
bash scripts/plan.sh test_outputs/<timestamp>_kyoto.json

# 4. Score it against the golden
npx tsx scripts/eval.ts test_outputs/<timestamp>_kyoto_itinerary.json golden/kyoto_april2026.json
```

**Golden files available:** `kyoto_april2026.json`, `yellowstone_may2026.json`, `grand_canyon_oct2026.json`, `zion_nov2026.json`

---

## Eval score history

| Destination | Run | Score | Key gap |
|---|---|---|---|
| Yellowstone | 1 | 55 | Timing not honored, recovery time 0 |
| Yellowstone | 2 | 62 | Grand Prismatic tip missing from notes |
| Yellowstone | 3 | 61 | Slight regression |
| Yellowstone | 4 | 55 | Prompt over-correction |
| Kyoto | 1 | 62 | Evening anchors wrong, recovery time 0 |
| Grand Canyon | 1 | 62 | Regional Page/canyon country circuit missed |
| Zion (no prefs) | 1 | 48 | Angels Landing scheduled for family_young 🔴 |
| Zion (family_young) | 2 | 55 | Party type fixed; shuttle + density still failing |
| Zion (family_young) | 3 | 56 | 4-stage pipeline; planning notes still too generic |

Score ceiling has been ~62 across 4 destinations. The two persistent failures are timing enforcement and activity density for family travel.

---

## What's been built (completed)

- [x] Full board generation pipeline with two-wave theme generation
- [x] Tip enhancement pass (post-generation, per-experience LLM rewrite)
- [x] Stay area recommendation (`recommended_stay_area`) with AssumptionsBar edit
- [x] OpenAI retry with backoff for 429 TPM rate limit errors
- [x] Party type preferences stored in board + passed through to planner
- [x] 4-stage planning pipeline (cluster → Pass 1 → Pass 2 → final)
- [x] Geographic clustering by walking distance
- [x] `planning_note` on every itinerary row (user-facing scheduling reasoning)
- [x] `change_log` from Pass 2 reviewer
- [x] Offline eval pipeline (`generate.sh` → `plan.sh` → `eval.ts`)
- [x] Golden itineraries for 4 destinations with weighted rubrics

## What's outstanding (known issues)

See `KNOWN_ISSUES.md` for full details on each. Summary:

| ID | Issue | Severity |
|---|---|---|
| ISSUE-001 | Board generates hallucinated experiences | High |
| ISSUE-002 | Family-friendly trail bias missing in board generation | High |
| ISSUE-003 | Shuttle/access restrictions absent from board cards | High |
| ISSUE-004 | Regional circuit destinations not discovered | Medium |
| ISSUE-005 | Score ceiling at ~62 — timing + recovery time | Medium |
| ISSUE-006 | Planning notes still too generic (being tested) | Medium |
| ISSUE-007 | Pass 2 reviewer too lenient (being tested) | Medium |
| ISSUE-008 | `generate.sh` preferences argument quoting bug | Low |
| ISSUE-009 | Eval scores non-deterministic (LLM-as-judge) | Low |

---

## For an incoming agent

**Codebase conventions:**
- All prompts live as `.md` files in `prompts/`. They are loaded at runtime by `lib/claude/prompts.ts` with the `load()` function — no rebuild needed to test prompt changes.
- The LLM client (`lib/llm/client.ts`) is provider-agnostic. All calls go through `callLLM(systemPrompt, userPrompt, provider)`. Default provider is `"openai"`.
- JSON parsing from LLM responses is handled by `parseJSON<T>()` in each route — strips markdown fences, then `JSON.parse`.
- The board schema is in `lib/types.ts` → `Board`, `Experience`, `Theme`. The itinerary schema is `Itinerary`, `ItineraryDay`, `ItineraryRow`.
- `planning_note` is a field on `ItineraryRow` — user-facing explanation of why an activity is scheduled when it is.
- `change_log` is a field on `Itinerary` — Pass 2 reviewer's list of what it changed (internal, not shown in UI yet).

**To run a quick eval loop:**  
Edit a prompt `.md` file → `bash scripts/plan.sh <existing_board_file>` → `npx tsx scripts/eval.ts <itinerary> <golden>`. No board regeneration needed unless you're testing board-level changes.

**Key prompt files to understand first:**
1. `prompts/system.md` — the board card schema and quality rules (most important)
2. `prompts/itinerary.md` — Pass 1 planner (where most scheduling decisions happen)
3. `prompts/itinerary-review.md` — Pass 2 reviewer (catches violations)
4. `prompts/distance-cluster.md` — clustering logic
