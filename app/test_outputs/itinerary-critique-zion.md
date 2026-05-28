# Itinerary Critique — Zion National Park, November 2026 (Couple, 5 Days)

**Source itinerary:** `2026-05-28_09-05-44_zion-national-park_itinerary.json`
**Travel dates:** Nov 15–19, 2026 | **Party:** Couple | **Arrival:** ~12:30

This document captures the specific failures found in the generated itinerary. Each point names the root cause in the planner, not just the symptom, so that the fix is unambiguous.

---

## Critique Point 1 — Angels Landing permit not flagged

**What the itinerary says:**
> "Start early to avoid crowds and enjoy cooler temperatures. A highlight of Zion, this strenuous hike offers breathtaking views worth the early rise."

**What it should say:**
Angels Landing requires an advance permit through the NPS day-before lottery. Without a confirmed permit, the traveler cannot legally hike the chains section. The planning note treats this as a show-up-and-go hike.

**Root cause:** The planner has no permit awareness rule. No instruction tells it to flag advance-booking requirements visible in `local_tip` or experience name.

**Fix:** Add a permit awareness rule to the planner: "If an experience's `local_tip` or name references a permit, lottery, or advance reservation: the `planning_note` must state the booking requirement, the booking window, and what the traveler should do before this trip starts."

---

## Critique Point 2 — The Narrows in November: no cold-water warning

**What the itinerary says:**
> "A unique Zion hike, this is an immersive experience into the park's iconic river-worn canyons."

**What it should say:**
The Virgin River in November runs at 40–50°F. Wading The Narrows without a drysuit is a safety risk, not a comfort issue. The NPS recommends drysuit rental for waders in cold months. Rental must be arranged the day before from outfitters in Springdale.

**Root cause:** The planner has no cold-water seasonal rule. Weather context (November water temps) never reaches the prompt. Even if it did, there is no rule linking cold months to wading hike gear requirements.

**Fix:** (a) Inject weather context into the itinerary prompt with a seasonal conditions block. (b) Add a cold-water rule: "In cold-water months (November–April), any wading hike `planning_note` must explicitly state water temperature and required gear."

---

## Critique Point 3 — Day 4: Observation Point via East Mesa is physically impossible

**What the itinerary schedules:**
`15:30–17:30` — Observation Point via East Mesa Trail

**What is actually true:**
- East Mesa Trail is 7.2 miles round-trip with 1,350 ft elevation gain
- 2 hours is insufficient even at a fast hiking pace (realistic: 3.5–4.5 hours)
- November sunset: 5:15 PM. A 15:30 start means hiking in full darkness
- East Mesa trailhead requires a 45-minute drive from Springdale through Zion-Mount Carmel Highway — after already spending the morning in Kolob Canyons (45 min from Springdale in the other direction)

**Root cause:** The planner has no knowledge of November's 5:15 PM sunset. Without a sunset constraint, it schedules activities starting 105 minutes before dark on a 3.5-hour trail. The reviewer (Pass 2) said "No changes."

**Fix:** (a) Inject sunset time into both Pass 1 and Pass 2 prompts. (b) Add a hard constraint: "No activity may end after sunset time. Verify each afternoon activity ends at least 60 minutes before sunset to allow safe exit." (c) Pass 2 must explicitly check for sunset violations.

---

## Critique Point 4 — November shuttle cessation not reflected

**What the itinerary says:**
> "Board at Zion Visitor Center stop. Free, runs every 6–8 minutes in peak season."

**What is actually true:**
Zion Canyon shuttle reduces service significantly in November and ceases entirely after Thanksgiving. This is documented in `cache/destinations/zion-national-park/weather_november.json`. A traveler reading "runs every 6–8 minutes" in November will show up to find hourly or no service.

**Root cause:** Travel implications from weather context never reach the itinerary planner. The shuttle status language is hardcoded in `prompts/itinerary.md` for peak season only.

**Fix:** Inject `weather_context.travel_implications` into the itinerary user prompt. The planner should then adapt shuttle language to the actual travel month conditions.

---

## Critique Point 5 — Day 4: Geographic impossibility (Kolob + East Mesa)

**What the itinerary schedules:**
- Morning: Kolob Canyons Scenic Drive + Timber Creek Overlook (45 min drive from Springdale, northwest)
- Afternoon: Observation Point via East Mesa (45 min drive from Springdale, northeast through Zion-Mount Carmel)

**What this requires:**
Return from Kolob (~12:30), drive through Springdale, exit through east tunnel, reach East Mesa trailhead by 15:30 — all after a morning of hiking. Total directional change: the two destinations are roughly 90 minutes apart from each other. This is a 3.5-hour driving day before any hiking.

**Root cause:** The geographic conflict check in Pass 2 uses "consider moving" language — it is advisory, not corrective. The reviewer did not flag this as a hard violation.

**Fix:** Strengthen Check 4 in `prompts/itinerary-review.md` from "consider" to a hard rule: "If total driving time on a single day exceeds 2 hours, the itinerary has a geographic violation. MOVE one activity to a different day."

---

## Critique Point 6 — Couple party type = no behavioral rules

**What the planner does for `couple`:**
> "No automatic exclusions."

That is the entire rule. Nothing else happens.

**What should happen for a couple trip to Zion:**
- At least one sunset viewpoint or sunset-timed activity (e.g., Canyon Junction Bridge, Watchman viewpoint, Zion Canyon Overlook at golden hour)
- Romantic dining prioritized — scenic setting, not just the nearest café
- No consecutive strenuous days — Day 2 (Angels Landing, strenuous) followed immediately by Day 3 (Narrows, strenuous) violates this
- Couple-oriented activities (stargazing, scenic drives together, photography spots) preferred over solo-experience hikes

**Root cause:** The `couple` case in `prompts/itinerary.md` has no positive rules — only the statement that there are no exclusions. The model treats `couple` the same as `solo`.

**Fix:** Add positive behavioral rules for `couple` in the party type section of `prompts/itinerary.md`.

---

## Critique Point 7 — Planning notes are generic (activity rows)

**Examples from this itinerary:**
- "A well-rounded breakfast to prepare for a day exploring Zion's natural wonders."
- "A gentle introduction to Zion's water features, offering scenic, hassle-free walking as the day begins."
- "A unique Zion hike, this is an immersive experience into the park's iconic river-worn canyons."
- "An iconic short hike providing a high-impact view, ideal for an afternoon when the light enhances the landscape."
- "Ideal for easy afternoon exploration — is accessible and contrasts the strenuous morning with a peaceful atmosphere."

None of these answer: *Why this time? Why this sequence? What should the traveler prepare for?*

These notes read identically to notes for any park in any country. The test from the prompt spec is: "Could this note appear in a guidebook to a completely different city?" — yes, all of them could.

**Root cause:** The Pass 2 reviewer has a planning note quality check (Check 7), but it is soft — the examples of "good" vs "bad" in `prompts/itinerary.md` don't seem to be internalised by the model. Pass 2 is not rewriting these notes.

**Fix:** (a) Add more specific bad-note examples to the system prompt. (b) The Pass 2 reviewer must rewrite all generic notes, not just flag them. (c) Add the specific test criteria to Pass 2's Check 7: "Ask yourself: does this note reference the actual time, the actual sequence logic, or a constraint specific to this traveler? If not, rewrite it."

---

## Critique Point 8 — Meal planning notes have zero content

**Examples:**
- "A refreshing pause with local flavors after the morning hike."
- "Dining options reflect the local spirit, capping a day of Zion's highlights with a savory meal."
- "Café Soleil is convenient for a quick, yet delightful lunch just as you arrive and before exploring nearby."
- "Rejuvenate with a quality meal in familiar settings following active river exploration."

These are filler. The prompt spec says meal notes should: "name the dish or say why this specific place — not just 'great food.'" The spec gives the example: "Order the green chile breakfast burrito — house-made, substantial enough to fuel 4 hours of hiking." Not one meal note in this itinerary meets that bar.

**Root cause:** The planning note rule distinguishes activity notes from meal notes but the model is not applying the meal-specific standard consistently. Pass 2 is not enforcing it.

**Fix:** Pass 2 Check 7 must explicitly check meal notes with the same rigor as activity notes. Add to the check: "For meal rows: if the note doesn't name a specific dish or give a concrete reason for choosing this place, rewrite it."

---

## Critique Point 9 — Back-to-back strenuous days for a couple

**The schedule:**
- Day 2: Angels Landing (strenuous, 5.4 mi, 1,488 ft gain)
- Day 3: The Narrows (strenuous, wading 2–3 hours in 40°F water)

Two consecutive strenuous days is standard training plan territory, not vacation territory. For a couple, the ideal structure would alternate: strenuous → easy/scenic → strenuous. A scenic Kolob Canyons day between the two hard canyon days would fix this.

**Root cause:** No recovery rule exists. The planner has no constraint that prevents scheduling consecutive strenuous days for any party type.

**Fix:** Add to `couple` rules (and consider for all party types): "Do not schedule strenuous activities on consecutive days. If Day N is strenuous, Day N+1 must be moderate or easy."

---

## Critique Point 10 — No destination depth cap

**The issue:**
If a couple said "I want 8 days in Zion," the planner would try to fill 8 days. The board does not have 8 days of distinctive content for Zion. Days 7 and 8 would contain thin filler or repeats.

**In this 5-day itinerary:**
Day 4 is already showing signs of depth strain — Kolob Canyons + East Mesa are combined into one day in a way that makes no geographic sense. A more honest planner would say "this is a 3–4 day destination; Day 4 content is thin; cut to 4 days."

**Root cause:** The planner has no concept of destination depth or content adequacy. It fills all days unconditionally.

**Fix:** Add a rule: "If the available experiences cannot fill all days with 3+ distinctive activities per day, produce a shorter itinerary. A 3-day itinerary with excellent content is better than a 5-day itinerary padded with drives and thin alternatives."

---

## Critique Point 11 — Pass 2 reviewer said "No changes" despite multiple violations

**What Pass 2 should have caught:**
1. East Mesa trail ending at 17:30 (darkness) — violation
2. Kolob + East Mesa geographic impossibility — violation
3. Angels Landing permit not mentioned — violation
4. Narrows cold water not mentioned — violation
5. Every single planning note in the itinerary — all generic

**What Pass 2 returned:**
`change_log: ["No changes — itinerary passed all checks."]`

**Root cause:** (a) The reviewer doesn't know about the November sunset. (b) Check 4 geographic conflict is advisory ("consider"), not corrective. (c) There are no checks for permit awareness or cold water. (d) The note quality check (Check 7) is soft and the reviewer is passing clearly generic notes.

**Fix:** This is the compound fix of all the above. Once the weather context reaches the reviewer and the checks are hardened, Pass 2 should catch and fix most of these.

---

## Summary Assessment

| Area | Rating | Key gap |
|---|---|---|
| Safety constraints (permits, cold water) | ❌ Failing | No permit or cold-water rules exist |
| Sunset / daylight awareness | ❌ Failing | Weather context never reaches planner |
| Geographic coherence | ⚠️ Weak | Reviewer uses advisory language only |
| Party-type personalization (couple) | ⚠️ Weak | "No exclusions" = no rules at all |
| Planning note quality | ⚠️ Weak | Generic across all rows; Pass 2 not enforcing |
| Departure day discipline | ✅ Passing | Day 5 is clean |
| Shuttle awareness | ⚠️ Weak | Peak-season language used for November |
| Activity pacing | ✅ Passing | 3 activities/day is appropriate |
| Day structure (morning anchor → afternoon) | ✅ Passing | Generally correct structure |
| Destination depth | ⚠️ Weak | Day 4 stretched thin |

**Priority fixes (in order):**
1. Inject weather context (sunset, travel implications) into both Pass 1 and Pass 2 prompts
2. Add couple behavioral rules (sunset activity, no back-to-back strenuous, romantic dining)
3. Add permit awareness rule to Pass 1 and Pass 2
4. Add cold-water seasonal warning rule
5. Harden geographic conflict check in Pass 2 (remove "consider" language)
6. Strengthen planning note enforcement in Pass 2 (rewrite, don't just flag)
