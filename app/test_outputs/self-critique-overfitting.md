# Self-Critique: Overfitting Audit — Zion → Yellowstone

**Date:** 2026-05-28
**Purpose:** After completing the Zion itinerary overhaul, run the same prompt stack on Yellowstone National Park with `family_young` party type to identify Zion-specific language or rules that would produce incorrect output at a different destination.

---

## What was tested

- **Yellowstone National Park** — geyser/thermal landscape, no shuttle required, no permit-gated hikes, no river-wading as a signature experience
- **Party type:** `family_young` (toddlers under 6) — completely different from the Zion `couple` test
- **Travel month:** July 2026 — summer peak, no cold-water concern, long daylight hours
- **Weather context:** sparse (month fields null — older board schema) → tested the partial-block weather injection path

---

## Overfitting risks identified

### 1. "Virgin River" hardcoded in Check 10 cold-water warning  `FIXED`

**What was there:**
> "⚠️ [Month] water temperature in the Virgin River is approximately [temp]°F..."

The Virgin River is Zion-specific. A Yellowstone or Grand Canyon reviewer would have inserted "Virgin River" into a warning about a completely different waterway.

**Fix:** Changed to "⚠️ [Month] water temperature in this waterway is approximately 35–55°F..." — destination-agnostic.

---

### 2. "Zion Canyon Shuttle to [Stop Name]" as example shuttle row format  `FIXED`

The shuttle row example in `prompts/itinerary.md` named "Zion Canyon Shuttle" explicitly. This could cause the model to echo "Zion Canyon" in a shuttle row for Yosemite or Grand Canyon.

**Fix:** Changed to "[Destination] Shuttle to [Stop Name]".

---

### 3. "The Narrows in November" as a planning note example  `FIXED`

The good-planning-note example referenced "The Narrows in November" specifically, tying the cold-water concept to a Zion landmark. A model trained on this example might generalize poorly to other destinations.

**Fix:** Replaced with a generic river canyon example: "November water temperature in this river canyon is 40–50°F. Rent gear from outfitters in [nearest town] the evening before — most close by 5 PM."

---

### 4. "Zion Outfitter or Zion Adventure Company" in Check 10  `FIXED`

The reviewer prompt's Check 10 named specific Zion outfitters. For a Narrows-equivalent hike at a different destination, the model would name Springdale businesses.

**Fix:** Removed specific brand names. Now: "Rent gear from outfitters near the trailhead the day before (most close by 5 PM)."

---

## What did NOT overfit

### Cold-water check: correctly silent for July Yellowstone

The `prompts/itinerary.md` cold-water rule (November–April) correctly did not trigger for July Yellowstone. No drysuit warnings appear in the output. The month check is general and works across destinations.

### Permit check: correctly silent for Yellowstone

No permit warnings were injected. Yellowstone's July experiences don't require advance lottery permits. The permit detection reads `local_tip` text — if no experience mentions "permit" or "lottery", no warning fires. Zero false positives.

### Sunset constraint: gracefully handled null data

The Yellowstone board has a null weather month object (older schema). The two-tier seasonal conditions block correctly fell back to the partial path (travel implications only, no sunset constraint). No "Sunset: null" was injected into the prompt. The graceful fallback is working.

### Family_young rules: destination-agnostic

The family_young rules correctly produced:
- Old Faithful Geyser (iconic, viewable from boardwalk — appropriate)
- Grand Prismatic Spring boardwalk (paved, stroller-accessible — appropriate)
- No cliff jumping (Firehole swimming hole removed)
- No backcountry hikes

The rules reference physical attributes (strenuous effort, cliff exposure, wading) rather than Zion-specific locations. They transfer correctly.

### Couple rules: not present for family_young

The couple pre-planning step (strenuous alternation, sunset dinner) did not bleed into the family_young trip. The rules are gated by `party_type` and correctly absent.

---

## Bugs surfaced by Yellowstone testing

### Bug 1: LLM activity count unreliable (max 2/day for family_young)

**Symptom:** Across 3 Yellowstone runs, days with 3 or 4 activities persisted despite the prompt saying "max 2." The reviewer logged phantom removals (logged in change_log but not reflected in output JSON).

**Root cause:** LLMs don't count JSON array elements reliably during generation. The reviewer writes the change_log optimistically (what it planned to do) while the generated JSON reflects what it unconsciously included.

**Fix:** Pre-flight violation injection in `reviewUserPrompt()` — TypeScript counts activity rows per day before the LLM call and injects explicit violation notices: "⚠️ Day 3: 3 activity rows — VIOLATION. Must remove 1. Least essential: [name]." This moves counting from LLM to code.

**Result after fix:** All days pass the 2-activity cap. ✅

### Bug 2: Cliff jumping not excluded for family_young

**Symptom:** "Cliff Jumping at Firehole Swimming Hole" labeled as `effort: moderate` appeared in a family_young itinerary. The strenuous filter didn't catch it. The cliff exposure filter missed it because the activity title didn't match "chains," "fixed ropes," or "cliff-edge."

**Root cause:** The exclusion list said "sustained cliff exposure" — cliff jumping is a brief exposure, not sustained. `effort: moderate` passed the strenuous filter.

**Fix:** Added explicit exclusions to both Pass 1 and Pass 2: "cliff jumping, jumping from heights, diving, wading or swimming in natural uncontrolled waterways" regardless of effort rating. The reviewer's Check 1 now explicitly lists cliff jumping as a hard safety exclusion.

### Bug 3: "Backcountry Hike to Slough Creek" for toddlers

**Symptom:** A backcountry hike appeared in a family_young itinerary. It was labeled `effort: moderate`, passing the strenuous filter.

**Root cause:** "Extended off-trail/backcountry travel" was not in the exclusion list.

**Fix:** Added "extended off-trail/backcountry travel" to family_young exclusions in `prompts/itinerary.md` and `prompts/itinerary-review.md`.

---

## Verdict: No systemic Zion-specific overfitting

The changes made for Zion are structurally general:

| Rule | Zion-specific? | Verdict |
|---|---|---|
| Sunset constraint (from weather context) | No — parameterized from board.weather_context | ✅ General |
| Cold-water month check (Nov–Apr) | No — month-based heuristic | ✅ General |
| Permit awareness (reads local_tip) | No — text-pattern based | ✅ General |
| Couple pre-planning (alternating strenuous) | No — effort-level based | ✅ General |
| family_young max 2 activities | No — count-based | ✅ General |
| Shuttle row format | Was "Zion Canyon" → fixed to [Destination] | ✅ Fixed |
| Cold-water warning text | Was "Virgin River" → fixed to generic | ✅ Fixed |
| Planning note example | Was "The Narrows" → fixed to generic canyon | ✅ Fixed |

**Three Zion-specific strings were found and removed.** The rules themselves are destination-agnostic. The overfitting was in the examples and one hardcoded outfitter name — not in the logic.

---

## Open items from this audit

1. **Activity count: pre-flight check only covers family_young.** Should extend to detect other party-type violations (strenuous for family_young, back-to-back strenuous for couple) pre-flight, not just activity count. (2026-05-28)

2. **Phantom change_log entries still occur** for checks that aren't pre-flight injected. The reviewer sometimes writes changes it didn't make. The "Change_log integrity" instruction reduced but didn't eliminate this. Long-term fix: post-process the itinerary in code to independently verify claimed removals. (2026-05-28)

3. **Weather month null fields on older boards.** Yellowstone's board has null sunrise/sunset/season_type fields because it was generated before the weather context schema was finalized. Fresh boards should have complete data. No action needed — the null-safety fix handles this gracefully. (2026-05-28)

4. **Day 1 arrival time boundary.** With 15:00 arrival, the arrival rule says "nothing" but Pass 1 scheduled 2 activities starting at 16:00. The arrival rule threshold is "after 15:00 = check-in only" — but 15:00 is exactly at the boundary. Clarify: "15:00 or later = check-in, dinner, rest only." (2026-05-28)
