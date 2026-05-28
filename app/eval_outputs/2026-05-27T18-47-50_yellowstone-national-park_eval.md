# Itinerary Eval — Yellowstone National Park
**Dates:** 2026-05-20 → 2026-05-25  |  **Grade: C  (55/100)**

> The AI itinerary fails to respect key wildlife timing and recovery principles, schedules excessive experiences, and provides inadequate travel time buffers. Some geographic coherence and select exclusion principles are not met, impacting the itinerary's feasibility and guest comfort.

## Board Coverage  (60/100)
✅ Found: Lamar Valley, Grand Canyon of the Yellowstone, Old Faithful, Grand Prismatic Spring, Norris Geyser Basin, Mammoth Hot Springs
❌ Missing: Tower Fall, Artist Point, Hayden Valley, Yellowstone Lake

## Dimension Scores
| Dimension | Weight | Score | Pass? | Finding |
|---|---|---|---|---|
| Wildlife timing | 20% | 0/100 | ❌ | Lamar Valley scheduled for wildlife viewing at 8:30 AM, too late for prime viewing. |
| Recovery time | 20% | 0/100 | ❌ | No rest period scheduled for days with early starts and several activities in a row. |
| Drive time realism | 15% | 70/100 | ✅ | Some drives accurately include time buffers, but others like from Canyon to Lamar Valley do not allow sufficient time. |
| Geographic coherence | 20% | 85/100 | ✅ | Geographic zones are mostly respected with separate days for different areas. |
| Experience density | 15% | 50/100 | ❌ | Over-scheduled activities, especially on Day 2, leading to a dense, exhausting itinerary. |
| Grand Prismatic tip quality | 5% | 0/100 | ❌ | Fails to mention the overlook trail, only suggests the midway boardwalk view. |
| Departure day discipline | 5% | 100/100 | ✅ | Correctly includes only drive and airport logistics on the final day. |

## Day-by-Day Analysis
### Day 1 — Arrival and Relaxation  (50/100)
*Golden: "Arrival — Bozeman to Canyon"*
**✅ Hits:** Dinner scheduled at Canyon Lodge · Evening relaxation included
**❌ Misses:** No travel instructions or routing through Bozeman Airport
**🚨 Worst mistake:** Scheduled dinner before accounting for travel logistics from Bozeman.

### Day 2 — Geysers and Springs Exploration  (40/100)
*Golden: "Lamar Valley — Wildlife Focus"*
**✅ Hits:** Includes major geysers like Old Faithful
**❌ Misses:** Missing timely wildlife viewing in Lamar Valley · No afternoon rest
**🚨 Worst mistake:** Packed full day without respecting the need for rest.

### Day 3 — Wildlife and Adventure  (45/100)
*Golden: "Grand Canyon of the Yellowstone + Hayden Sunset"*
**✅ Hits:** Scheduled wildlife viewing
**❌ Misses:** Scheduled wildlife viewing too late · Omitted Hayden Valley for sunset wildlife spotting
**🚨 Worst mistake:** Misunderstood the golden hour for optimal wildlife viewing.

### Day 4 — Canyon and Geothermal Features  (65/100)
*Golden: "Geyser Loop — Old Faithful + Grand Prismatic"*
**✅ Hits:** Included Grand Canyon of the Yellowstone visit
**❌ Misses:** Insufficient drive times · Inadequate time buffers
**🚨 Worst mistake:** Failed to prioritize Grand Prismatic's overlook trail.

### Day 5 — Relaxation and Unique Experiences  (70/100)
*Golden: "Norris Geyser Basin + Yellowstone Lake — Balanced Day"*
**✅ Hits:** Included Norris Geyser Basin
**❌ Misses:** Failed to include Yellowstone Lake · Phrasing suggests more intensity than intended
**🚨 Worst mistake:** Excluded Yellowstone Lake relaxation, which was intended for ease and enjoyment.

### Day 6 — Departure  (90/100)
*Golden: "Exit — Canyon to Bozeman"*
**✅ Hits:** Focused solely on departure logistics
**🚨 Worst mistake:** Minor: Could better explain departure day strategy in terms of buffer times.

## Top Failures
### 🚨 Wildlife Timing Error  `critical`
Lamar Valley viewing is scheduled too late at 8:30 AM, missing the optimal wildlife viewing period.

**Prompt fix:** *Incorporate specific guidelines for wildlife activities to be scheduled before 8 AM and after 5 PM for best sightings.*

### ⚠️ Lack of Recovery Time  `major`
Failed to include any structured rest time in itineraries with early starts and multiple activities.

**Prompt fix:** *Mandate 1.5-2 hr rest blocks in any day starting before 8 AM or with 4+ major activities.*

### ⚠️ Grand Prismatic Overlook Exclusion  `major`
Failed to include the overlook trail for viewing Grand Prismatic Spring, which offers a superior vantage point.

**Prompt fix:** *Ensure itineraries suggest the Grand Prismatic overlook trail for the best viewing experience, not just the boardwalk.*

## What the AI Got Right
- Followed single base camp principle by consistently using Canyon Lodge.
- Good geographic coherence by segmenting the park by regions for each day.

## Prompt Improvement Plan
### Changes to `prompts/itinerary.md`
- Include explicit instructions to schedule rest and recovery periods in busy or early-start itineraries.
- Integrate clear guidance about optimal wildlife viewing times.

### Changes to board/destination prompts
- Ensure key sights, especially easier and high-value experiences like Yellowstone Lake, are prioritized.
- Enhance geographic filtering to respect specific exclusion for well-known but lower-priority stops per expert guidance.