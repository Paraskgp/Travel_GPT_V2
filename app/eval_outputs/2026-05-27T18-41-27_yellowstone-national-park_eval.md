# Itinerary Eval — Yellowstone National Park
**Dates:** 2026-05-20 → 2026-05-25  |  **Grade: C  (61/100)**

> The AI itinerary covers several key Yellowstone attractions and maintains a coherent day structure but fails significantly in wildlife timing and recovery time, both critical for client satisfaction. Improvements are essential in adhering to realistic drive times and geographic coherence.

## Board Coverage  (50/100)
✅ Found: Lamar Valley, Grand Canyon of the Yellowstone, Old Faithful, Norris Geyser Basin
❌ Missing: Hayden Valley, Artist Point, Grand Prismatic Spring (overlook), Yellowstone Lake

## Dimension Scores
| Dimension | Weight | Score | Pass? | Finding |
|---|---|---|---|---|
| Wildlife timing | 20% | 40/100 | ❌ | Wildlife viewing is scheduled from 15:00 to 19:00, missing optimal dawn and dusk windows. |
| Recovery time | 20% | 30/100 | ❌ | No explicit rest periods scheduled after early morning starts. |
| Drive time realism | 15% | 50/100 | ❌ | Several drive times are underestimated, impacting schedule feasibility. |
| Geographic coherence | 20% | 70/100 | ✅ | Days are generally kept within reasonable geographic zones. |
| Experience density | 15% | 60/100 | ✅ | Generally adheres to 2-3 headline experiences per day but misses on rest days and starts. |
| Grand Prismatic tip quality | 5% | 0/100 | ❌ | Fails to mention the overlook trail for Grand Prismatic Spring. |
| Departure day discipline | 5% | 100/100 | ✅ | Departure day is correctly kept to just checkout and travel activities. |

## Day-by-Day Analysis
### Day 1 — Arrival and Orientation  (60/100)
*Golden: "Arrival — Bozeman to Canyon"*
**✅ Hits:** Orientation session scheduled soon after arrival · Dinner at Canyon Lodge
**❌ Misses:** Evening stroll scheduled which contradicts no demanding evening activities
**🚨 Worst mistake:** Schedules evening wildlife spotting which is demanding after travel.

### Day 2 — Geothermal Wonders and Wildlife  (40/100)
*Golden: "Lamar Valley — Wildlife Focus"*
**✅ Hits:** Includes Old Faithful and Grand Prismatic which are key experiences
**❌ Misses:** Wildlife viewing in Lamar Valley scheduled after optimal times · No rest in afternoon despite early start
**🚨 Worst mistake:** Schedules wildlife watching at inappropriate times for optimal sightings.

### Day 3 — Geysers and Hiking  (50/100)
*Golden: "Grand Canyon of the Yellowstone + Hayden Sunset"*
**✅ Hits:** Includes Norris Geyser Basin and Mount Washburn
**❌ Misses:** No afternoon rest period despite early start and long hike · Norris late afternoon viewing is mentioned oddly in the morning
**🚨 Worst mistake:** No rest period after a demanding morning schedule.

### Day 4 — Canyon and Lake Scenes  (70/100)
*Golden: "Geyser Loop — Old Faithful + Grand Prismatic"*
**✅ Hits:** Correctly schedules a visit to Yellowstone Lake and Grand Canyon
**❌ Misses:** Activities in the Grand Canyon missed colloquial reference to both Artist Point and Lower Falls
**🚨 Worst mistake:** Fails to ensure both Artist Point and Lower Falls are highlighted.

### Day 5 — Northern Yellowstone Day  (45/100)
*Golden: "Norris Geyser Basin + Yellowstone Lake — Balanced Day"*
**✅ Hits:** Includes Mammoth Hot Springs and Boiling River
**❌ Misses:** Travel time overestimated between distances,
**🚨 Worst mistake:** Includes too many activities without appropriate rest and realistic travel estimates.

### Day 6 — Departure from Yellowstone  (80/100)
*Golden: "Exit — Canyon to Bozeman"*
**✅ Hits:** Departure logistics are appropriately scheduled
**❌ Misses:** Early start time might not be necessary
**🚨 Worst mistake:** Departure day is generally well-planned.

## Top Failures
### ⚠️ Wildlife timing  `major`
Failed to schedule wildlife viewing at appropriate dawn or dusk times, limiting potential sightings.

**Prompt fix:** *Incorporate 'Include wildlife viewing at dawn or dusk only' in nature activity scheduling.*

### ⚠️ Recovery time omission  `major`
Misses critical rest periods especially given early start days, impacting visitor energy levels.

**Prompt fix:** *Mandate 1.5-hour rest block after any early morning or vigorous activity.*

### 💡 Grand Prismatic viewing advice  `minor`
Misses expert advice to use the overlook trail for best Grand Prismatic Spring viewing.

**Prompt fix:** *Add 'always include Grand Prismatic Spring Overlook' to tips section.*

## What the AI Got Right
- Maintained a single base camp strategy at Canyon Lodge.
- Did not schedule activities on departure day ensuring logistic focus.

## Prompt Improvement Plan
### Changes to `prompts/itinerary.md`
- Require explicit rest periods in itineraries that include early morning starts or extended activities.
- Include specific guidance to schedule wildlife activities only during dawn or dusk times.

### Changes to board/destination prompts
- Ensure all 'must include' attractions like Artist Point and Hayden Valley appear in the suggestions.
- Incorporate guidance on best viewing advice for attractions like Grand Prismatic Spring.