# Itinerary Eval — Yellowstone National Park
**Dates:** 2026-05-20 → 2026-05-25  |  **Grade: C  (62/100)**

> The AI-generated itinerary fails on various critical aspects such as wildlife timing, recovery time inclusion, and drive time realism. Though it includes several must-have locations, it misses critical planning principles like geographic coherence and experience density management.

## Board Coverage  (78/100)
✅ Found: Lamar Valley, Grand Canyon of the Yellowstone, Artist Point, Old Faithful, Grand Prismatic Spring, Norris Geyser Basin, Mammoth Hot Springs
❌ Missing: Hayden Valley, Yellowstone Lake

## Dimension Scores
| Dimension | Weight | Score | Pass? | Finding |
|---|---|---|---|---|
| Wildlife timing | 20% | 50/100 | ❌ | Wildlife viewing in Lamar Valley starts appropriately early, but no wildlife activity was scheduled in the evening at Hayden Valley. |
| Recovery time | 20% | 40/100 | ❌ | Activities are scheduled continuously without sufficient recovery time, especially after early starts. |
| Drive time realism | 15% | 60/100 | ✅ | Some drive times are underestimated, failing to consider wildlife jams and realistic park conditions. |
| Geographic coherence | 20% | 70/100 | ✅ | Days are mostly contained within reasonable geographic zones but could be better optimized for efficiency. |
| Experience density | 15% | 50/100 | ❌ | Several days are overloaded with activities, undermining the travel experience. |
| Grand Prismatic tip quality | 5% | 0/100 | ❌ | The itinerary only mentions Grand Prismatic Spring by name, with no mention of the overlook trail. |
| Departure day discipline | 5% | 100/100 | ✅ | No activities are scheduled on the departure day, adhering to planned logistics. |

## Day-by-Day Analysis
### Day 1 — Arrival and Relaxation  (50/100)
*Golden: "Arrival — Bozeman to Canyon"*
**✅ Hits:** Dinner at Canyon Lodge Dining Room is correctly planned.
**❌ Misses:** No relaxation activities or light walks scheduled upon arrival. · Meal is the only scheduled activity.
**🚨 Worst mistake:** Overlooks the importance of recovery time upon arrival.

### Day 2 — Geysers and Falls Exploration  (60/100)
*Golden: "Lamar Valley — Wildlife Focus"*
**✅ Hits:** Correctly includes Grand Canyon of the Yellowstone.
**❌ Misses:** Attempts a packed schedule without rest post-morning activities. · Schedules wildlife best done early in the day are neglected.
**🚨 Worst mistake:** Schedules midday activities when rest was needed after Lamar Valley.

### Day 3 — Geysers and Springs  (45/100)
*Golden: "Grand Canyon of the Yellowstone + Hayden Sunset"*
**✅ Hits:** Covers Old Faithful and Grand Prismatic reasonably well.
**❌ Misses:** Fails to mention overlook for Grand Prismatic. · Doesn't include Hayden Valley evening wildlife viewing.
**🚨 Worst mistake:** Omission of the overlook tip for Grand Prismatic Spring.

### Day 4 — Wildlife Wonders  (55/100)
*Golden: "Geyser Loop — Old Faithful + Grand Prismatic"*
**✅ Hits:** Includes Norris Geyser Basin.
**❌ Misses:** Lacks balance in wildlife activities, specifically the evening at Hayden Valley. · No clear rest period after early morning start.
**🚨 Worst mistake:** Neglects essential evening wildlife viewing at Hayden Valley.

### Day 5 — Trails and Peaks  (60/100)
*Golden: "Norris Geyser Basin + Yellowstone Lake — Balanced Day"*
**✅ Hits:** Includes Mount Washburn.
**❌ Misses:** Incomplete inclusion of Yellowstone Lake as a relaxation site. · Prolonged day without sufficient rest segments.
**🚨 Worst mistake:** Misallocation of relaxation time at Yellowstone Lake.

### Day 6 — Departure  (80/100)
*Golden: "Exit — Canyon to Bozeman"*
**✅ Hits:** Only includes departure and travel logistics.
**❌ Misses:** Lacks contingency plans for potential travel delays due to wildlife or construction.
**🚨 Worst mistake:** Lacks explicit mention of possible delays or contingencies.

## Top Failures
### 🚨 Wildlife Timing Mismanagement  `critical`
Wildlife viewing scheduled outside of golden hours, with critical omissions in evening schedules.

**Prompt fix:** *Guidance on wildlife viewing should specify dawn and dusk as the optimal times, explicitly stating 'never schedule wildlife activities between 10 AM and 4 PM.'*

### ⚠️ Overlook Trail Omission  `major`
Neglects to mention the necessary overlook trail for Grand Prismatic, which drastically affects experience quality.

**Prompt fix:** *Emphasize, 'Grand Prismatic requires the overlook trail for the best view; boardwalk-only views are insufficient.'*

### ⚠️ Insufficient Recovery Time  `major`
The itinerary fails to integrate critical recovery periods after intense activities or early starts.

**Prompt fix:** *Include a mandatory 1.5-2 hour afternoon rest block in days with early starts or 4+ activities.*

## What the AI Got Right
- Incorporated famous Yellowstone landmarks like Old Faithful.
- Departure day adhered to logistics without additional activities.
- Some days maintain geographic coherence.

## Prompt Improvement Plan
### Changes to `prompts/itinerary.md`
- Add guidance to include dawn and dusk as fixed times for wildlife activities, emphasizing Lamar and Hayden Valley.
- Insert a mandatory 1.5-2 hour rest block for days with early starts or intense activity schedules.

### Changes to board/destination prompts
- Incorporate a clear distinction between Grand Prismatic overlook and boardwalk in location tips.
- Enforce a rule on avoiding sightseeing activities for departure days with early flights.