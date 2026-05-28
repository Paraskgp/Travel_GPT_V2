# Itinerary Eval — Yellowstone National Park
**Dates:** 2026-05-20 → 2026-05-25  |  **Grade: C  (55/100)**

> The AI itinerary lacks adherence to critical wildlife activity timing and does not allow sufficient rest periods. It fails in geographic coherence with overly ambitious daily routes, leading to a scattered experience without the necessary focus on must-see attractions.

## Board Coverage  (70/100)
✅ Found: Lamar Valley, Grand Canyon of the Yellowstone, Hayden Valley, Old Faithful, Norris Geyser Basin, Yellowstone Lake
❌ Missing: Tower Fall, Grand Prismatic Spring

## Dimension Scores
| Dimension | Weight | Score | Pass? | Finding |
|---|---|---|---|---|
| Wildlife timing | 20% | 20/100 | ❌ | Wildlife activities are scheduled outside optimal times. |
| Recovery time | 20% | 0/100 | ❌ | No dedicated rest periods; activities run continuously. |
| Drive time realism | 15% | 30/100 | ❌ | Drive times are underestimated with no traffic buffer. |
| Geographic coherence | 20% | 40/100 | ❌ | Daily itineraries lack geographic focus, leading to inefficient travel. |
| Experience density | 15% | 60/100 | ✅ | Most days have reasonable activity density, but lacking in rest breaks. |
| Grand Prismatic tip quality | 5% | 0/100 | ❌ | Overlook trail not specified, overlooking optimal viewing advice. |
| Departure day discipline | 5% | 50/100 | ❌ | Departure day includes activities that risk flight timing. |

## Day-by-Day Analysis
### Day 1 — Arriving at Old Faithful  (60/100)
*Golden: "Arrival — Bozeman to Canyon"*
**✅ Hits:** Includes arrival meal at Old Faithful.
**❌ Misses:** Late arrival activities after long travel.
**🚨 Worst mistake:** Scheduling evening viewing event right after arrival.

### Day 2 — Geothermal Highlights  (40/100)
*Golden: "Lamar Valley — Wildlife Focus"*
**✅ Hits:** Covers major geothermal attractions.
**❌ Misses:** Drive time underestimated. · No focus on early or late wildlife viewing.
**🚨 Worst mistake:** Activities span from early morning until late evening without rest.

### Day 3 — Adventures in the Yellowstone River  (50/100)
*Golden: "Grand Canyon of the Yellowstone + Hayden Sunset"*
**✅ Hits:** Includes kayaking as a diverse experience.
**❌ Misses:** Wildlife at a non-optimal time. · No planned rest period.
**🚨 Worst mistake:** Lack of focus on golden hour for Hayden Valley viewing.

### Day 4 — Canyons and Valleys  (50/100)
*Golden: "Geyser Loop — Old Faithful + Grand Prismatic"*
**✅ Hits:** Visits to key canyon areas.
**❌ Misses:** No rest period after early extensive activity.
**🚨 Worst mistake:** Full activity load without accounting for fatigue.

### Day 5 — Lake and Falls  (55/100)
*Golden: "Norris Geyser Basin + Yellowstone Lake — Balanced Day"*
**✅ Hits:** Includes Yellowstone Lake for scenic downtime.
**❌ Misses:** Tower Fall viewpoint scheduled at non-ideal time.
**🚨 Worst mistake:** Tasking high-value scenic areas without sufficient time.

### Day 6 — Farewell to Yellowstone  (45/100)
*Golden: "Exit — Canyon to Bozeman"*
**✅ Hits:** Focus on departure logistical timing.
**❌ Misses:** Unnecessary sightseeing risking departure timing. · Firehole Lake Drive unrelated to departure focus.
**🚨 Worst mistake:** Excessive activities scheduled on departure day.

## Top Failures
### 🚨 Inconvenient wildlife timing  `critical`
Wildlife activities are scheduled outside optimal viewing times, missing prime wildlife sightings.

**Prompt fix:** *Incorporate guidance to schedule wildlife viewing activities only during early morning and late afternoon/evening hours.*

### ⚠️ Lack of rest periods  `major`
The itinerary schedules activities back-to-back with no breaks, leading to an exhausting experience.

**Prompt fix:** *Include mandatory 1.5-2 hour rest periods in itineraries with 4+ activities or early start times.*

### ⚠️ Underestimated drive times  `major`
Drive times in the park are underestimated without accounting for potential wildlife jams or traffic.

**Prompt fix:** *Adjust drive time estimates by adding a 25-50% buffer over standard map times for all intra-park travel.*

## What the AI Got Right
- Included a nice variety of geothermal and scenic locations.
- Offered some unique experiences like kayaking.
- Provided multiple dining options throughout the stay.

## Prompt Improvement Plan
### Changes to `prompts/itinerary.md`
- Enforce time-of-day guidance for wildlife viewing to ensure activities are scheduled during optimal hours.
- Mandate inclusion of rest/free periods with a 1.5-2 hr minimum, particularly on days starting before 8 AM.
- Add a buffer of 25-50% to all intra-park drive time estimates to account for variable conditions.

### Changes to board/destination prompts
- Ensure all must-have locations from the human's golden reference are included in AI-generated boards.
- Improve AI understanding of sight sequencing, prioritizing activities that reflect local knowledge (e.g., Grand Prismatic overlook).