# Known Issues — TravelGPT

This document tracks outstanding issues that were identified during eval runs but not fixed in the current session. Each entry has enough context for an independent agent to pick it up and work on it.

Last updated: 2026-05-27

---

## ISSUE-001: Board generates hallucinated experiences

**Severity:** High  
**Affects:** Board quality across all destinations  
**First seen:** Zion eval (Run 2)

**What happens:**  
The board generation LLM occasionally invents experiences that do not exist at the destination. Example found in Zion: "Cerulean Forest Reflection Pool" — a completely fabricated location with a convincing-sounding description and location_hint ("Cerulean Forest, Zion National Park"). The experience was then scheduled in the itinerary.

**Why it's hard to fix now:**  
There is no validation step that checks whether board experiences are real. The board is accepted as ground truth by the planner and reviewer.

**What a fix would look like:**  
1. Add a post-generation validation pass that calls a search API (e.g. Google Places, Wikipedia API) to verify each `location_hint` returns a real result.  
2. Or: add a self-critique step at the end of board generation where the LLM is asked "For each experience, is this a real, verifiable place at this destination? Flag any you're uncertain about."  
3. Key files: `app/api/generate/route.ts` (after `enhancedThemes` is built, before assembling `board`), `prompts/system.md` (add a verification instruction).

---

## ISSUE-002: Family-friendly trail bias in board generation

**Severity:** High  
**Affects:** Destinations used with `party_type: family_young`  
**First seen:** Zion eval — Pa'rus Trail absent from board

**What happens:**  
When generating a board for a destination with `party_type: family_young`, the LLM does not reliably prioritize stroller-friendly, paved, short trails. For Zion, Pa'rus Trail (the most important family-friendly trail in the park, explicitly the Day 1 activity in the human golden) was missing from the board entirely. Instead, the board included Riverside Walk (only accessible via shuttle, not stroller-friendly for the full length) and a hallucinated experience.

**Why it's hard to fix now:**  
The theme prompts receive `party_type` via `preferences` but the instruction to "prioritize stroller-friendly trails" is not specific enough. The LLM interprets family_young as a ranking hint, not as a constraint on what it generates.

**What a fix would look like:**  
In the theme user prompt for `hiking_outdoors` (and `signature`), when `preferences.party_type === "family_young"`, explicitly instruct: "For this party type, only include trails that are paved OR under 2 miles AND rated easy. Do not include trails that require wading, chains, or significant elevation gain. The most essential experiences for this party type are paved riverside walks, short waterfall trails, and drive-by scenic stops."  
Key files: `lib/claude/prompts.ts` → `themeUserPrompt()`, `prompts/themes/hiking_outdoors.md`, `prompts/themes/signature.md`

---

## ISSUE-003: Shuttle system awareness absent from board cards

**Severity:** High  
**Affects:** Any destination with mandatory shuttle systems (Zion, Yosemite Valley, etc.)  
**First seen:** Zion evals (all runs)

**What happens:**  
Zion's main canyon is shuttle-only from spring through fall. The itinerary planner repeatedly tells travelers to "drive to Weeping Rock" or "drive to the Grotto" — which is impossible during peak season. The board cards for these experiences do not mention the shuttle in their `watch_out_for` or `local_tip` fields, so the planner has no signal.

**Why it's hard to fix now:**  
This is a board content quality issue. The tip enhancement pass (`prompts/tip-enhancement.md`) rewrites tips for vivid detail but doesn't specifically prompt for logistical access information.

**What a fix would look like:**  
1. Add a logistics field to the experience schema: `access_note: string | null` — intended specifically for mandatory transport restrictions (shuttle-only, permit required, ferry-only, etc.).  
2. In the board system prompt (`prompts/system.md`), add: "For any experience in a location with restricted access (shuttle-only zones, boat-only access, permit-required areas), the `watch_out_for` field MUST mention the access restriction and the typical operational details."  
3. In the itinerary prompt (`prompts/itinerary.md`), add a travel row rule: "If a cluster's `cluster_note` mentions shuttle-only access, the travel row to that cluster must say 'Take the free park shuttle (no private vehicles allowed in this zone during peak season)' not 'Drive to X'."  
Key files: `lib/types.ts` (schema), `prompts/system.md`, `prompts/itinerary.md`, `prompts/distance-cluster.md` (cluster_note)

---

## ISSUE-004: Grand Canyon regional circuit not discovered

**Severity:** Medium  
**Affects:** Regional destination queries  
**First seen:** Grand Canyon eval (Run 1, score 62/100, 20/100 on regional context)

**What happens:**  
When generating a board for "Grand Canyon National Park, South Rim," the AI fills all available days with South Rim content. It never discovers the adjacent canyon country circuit (Page, AZ — Horseshoe Bend, Antelope Canyon, Lake Powell) that the human planner spent 3 of 7 days visiting. The human's key insight: 1.5 days at the South Rim is enough — the Page area is what makes the trip special.

**Why it's hard to fix now:**  
The destination query constrains what the board generates. If you ask for "Grand Canyon," you get Grand Canyon. The regional circuit requires the AI to reason about adjacent regions that make a _complete trip_ — which is not what the current destination context prompt asks for.

**What a fix would look like:**  
1. In the destination context prompt (`prompts/destination-context.md`), add a field: `regional_complements: string[]` — other destinations within 4 hours that are commonly combined with this one on a multi-day trip. Example for Grand Canyon: ["Page, AZ (Horseshoe Bend, Antelope Canyon)", "Sedona, AZ"].  
2. Surface this in the itinerary prompt as "Regional day trips available from base" — the planner can then suggest a day trip to Page.  
3. Or, at the generate step: if trip length > 5 days AND destination has known regional complements, auto-expand the board to include a Day Trips theme with content from those regions.  
Key files: `prompts/destination-context.md`, `lib/types.ts` (DestinationContext), `prompts/itinerary.md`

---

## ISSUE-005: Score ceiling at ~62 — timing and recovery time

**Severity:** Medium  
**Affects:** All destinations  
**First seen:** Yellowstone runs 1–4, Kyoto run 1

**What happens:**  
Across 4 destinations and 7 eval runs, the overall score has not exceeded 62/100. The two persistent failures are:
1. **Timing enforcement** — experiences with a dawn `best_time` (e.g. Lamar Valley wolf activity at 06:00–07:30) are scheduled at 08:30 or 09:00 instead
2. **Recovery time** — the prompt says "leave 90 minutes unscheduled after an early start" but the LLM ignores this and fills the afternoon

Both score dimensions have been addressed in the prompts multiple times with increasingly specific language. The improvements are marginal.

**Why it's hard to fix now:**  
This is a single-pass LLM planning problem. The planner tries to optimize both "best schedule" and "follow all constraints" simultaneously. Under token pressure (large boards, many experiences), the constraints are what get dropped.

**What a fix would look like:**  
The new Pass 2 reviewer (itinerary-review.md) now explicitly checks for timing violations and activity stretch > 3.5 hours. This should help. But if it doesn't, the deeper fix is:  
1. Add a structured "constraint pre-pass" before Pass 1: the LLM outputs a JSON list of `{experience_id, scheduled_time, constraint_reason}` for all time-locked experiences BEFORE writing the full itinerary. This forces explicit constraint resolution before creative scheduling begins.  
2. Or: implement "anchor-first" scheduling — Pass 1 only places time-locked anchors, Pass 2 fills in the rest around them.  
Key files: `prompts/itinerary.md`, `app/api/plan/route.ts` (could add an "anchor extraction" stage between clustering and Pass 1)

---

## ISSUE-006: Planning notes quality — LLM writes descriptions, not reasoning

**Severity:** Medium  
**Affects:** All destinations  
**First seen:** Zion Run 2 (new pipeline)

**What happens:**  
The `planning_note` field was added to every activity row in the new pipeline. However, the LLM consistently writes activity descriptions ("A gentle start with this picturesque stroller-friendly walk") rather than scheduling reasoning ("Starting here because it's the only paved, stroller-accessible trail after a 14:00 arrival — energy budget for day 1 is limited"). The note is user-facing and should explain the *why*, not the *what*.

**Current fix attempt:**  
Updated `prompts/itinerary.md` with explicit BAD/GOOD examples and a test ("Could this note appear in a different city's guidebook? If yes, rewrite."). Not yet re-evaluated.

**What a deeper fix looks like if examples don't work:**  
Add a dedicated planning_note refinement pass (a quick LLM call, 1-2 seconds) that receives all activity rows with generic notes and rewrites them. This separates the creative scheduling task from the note-writing task, similar to how the tip enhancement pass (Stage 1) already rewrites `local_tip` fields post-generation.  
Key files: `app/api/plan/route.ts` (add Stage 5), `prompts/` (new `planning-note-refinement.md`)

---

## ISSUE-007: Pass 2 reviewer too lenient — says "no changes" when issues exist

**Severity:** Medium  
**Affects:** All destinations  
**First seen:** Zion Run 2

**What happens:**  
The Pass 2 reviewer returned `change_log: ["No changes — itinerary passed all checks."]` for a Zion family_young itinerary that: (a) had no shuttle mentions, (b) had too many activities per day for a toddler family, (c) had generic planning notes throughout. The reviewer is not catching real problems.

**Current fix attempt:**  
Rewrote `prompts/itinerary-review.md` with quantified, per-check criteria (e.g. "count activity rows per day — any day with >3 activity rows: remove the least essential"). Not yet re-evaluated.

**What a deeper fix looks like if still lenient:**  
1. Run the reviewer with `temperature: 0` (deterministic) and a structured output schema that forces it to fill in a checklist before returning the itinerary. A filled checklist makes it harder to say "no changes" without examining each item.  
2. Or: split the reviewer into two calls — one call that only produces the `change_log` (what to fix), and a second call that applies those fixes. The separation forces the critic role to be exhaustive before the fixer role starts.  
Key files: `app/api/plan/route.ts` (Stage 4), `prompts/itinerary-review.md`, `lib/llm/client.ts` (temperature parameter)

---

## ISSUE-008: `generate.sh` shell argument quoting bug for preferences JSON

**Severity:** Low  
**Affects:** `scripts/generate.sh` CLI usage  
**First seen:** Zion board generation attempts

**What happens:**  
When passing a preferences JSON as the 6th argument to `generate.sh`, the shell adds an extra `}` to the JSON string (`{"party_type":"family_young"}` becomes `{"party_type":"family_young"}}`). This makes `jq --argjson` reject it as invalid JSON. The workaround is to set the preferences as an env var first (`PREFS='...'`) and pass `"$PREFS"`, which still fails.

**Current workaround:**  
Call the `/api/generate` endpoint directly with `curl` and a heredoc JSON body.

**What a fix looks like:**  
Switch the preferences argument in `generate.sh` from inline JSON to a file path: `bash scripts/generate.sh "Zion" "2026-11-01" "2026-11-05" "" "" prefs.json`. Read the file with `jq '.' prefs.json` instead of `--argjson`. Alternatively, accept individual preference flags: `--party-type family_young`.  
Key file: `scripts/generate.sh`

---

## ISSUE-009: Eval script uses LLM-as-judge — results are non-deterministic

**Severity:** Low (known limitation)  
**Affects:** `scripts/eval.ts`

**What happens:**  
The eval script uses GPT-4o to score the itinerary against the golden. Different runs of the same itinerary produce different scores (±5–10 points) because LLM outputs are stochastic. This makes it hard to tell whether a prompt change improved things or whether the score delta is just noise.

**What a fix looks like:**  
1. Run each eval 3× and average the scores. Add a `score_variance` field to the output.  
2. Or: switch to `temperature: 0` for eval calls to make them deterministic.  
3. Or: replace the LLM judge for specific dimensions (activity count, timing, departure day) with code-based checks — these are mechanical and don't need an LLM.  
Key file: `scripts/eval.ts`

---

*To onboard an agent to fix any of these: give them this document + the files listed in "Key files" + read access to `prompts/` and `app/`. Each issue is self-contained and can be worked independently.*
