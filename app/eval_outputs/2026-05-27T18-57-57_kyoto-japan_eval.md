# Itinerary Eval — Kyoto, Japan
**Dates:** 2026-05-20 → 2026-05-25  |  **Grade: C  (62/100)**

> The AI itinerary for Kyoto lacks coherence and fails to follow critical timing rules for iconic sites, significantly impacting its effectiveness. While it covers several key locations, it neglects essential hidden gems and over-schedules days, reducing overall experience quality.

## Board Coverage  (70/100)
✅ Found: Fushimi Inari Taisha, Arashiyama Bamboo Grove, Kinkaku-ji, Kiyomizudera Temple, Nishiki Market, Gion District Stroll
❌ Missing: Ryoan-ji, Tenryu-ji Temple and Garden, Pontocho, Ninenzaka / Sannenzaka

## Dimension Scores
| Dimension | Weight | Score | Pass? | Finding |
|---|---|---|---|---|
| Dawn timing for iconic sites | 25% | 50/100 | ❌ | Arashiyama Bamboo Grove is scheduled at 08:00 and Fushimi Inari Taisha at 06:00 but lacks strategic dawn timing for maximum effect. |
| District-per-day coherence | 20% | 55/100 | ❌ | The itinerary combines different districts in a single day, such as Arashiyama and travel to Sanjusangendo Temple on the same day. |
| Evening anchors | 15% | 70/100 | ✅ | The itinerary includes Gion District Stroll in the evening but lacks other essential evening anchor points like Pontocho. |
| Recovery time | 15% | 40/100 | ❌ | Activities are scheduled back-to-back with insufficient time for rest on days with early starts. |
| Hidden gems / local knowledge | 10% | 30/100 | ❌ | The itinerary lacks inclusion of hidden gems such as Jojakko-ji or Nanzen-ji aqueduct. |
| Departure day discipline | 10% | 90/100 | ✅ | The AI itinerary respects departure day discipline, ensuring travel to the departure point without sightseeing. |
| Meal quality | 5% | 80/100 | ✅ | Several Kyoto-specific meal experiences are named, including kaiseki and yudofu. |

## Day-by-Day Analysis
### Day 1 — Arrival in Kyoto  (75/100)
*Golden: "Arrival in Kyoto"*
**✅ Hits:** Gion District Stroll · Kaiseki Ryori Experience
**❌ Misses:** The evening is slightly over-scheduled given typical travel fatigue.
**🚨 Worst mistake:** Dinner is scheduled too early considering a typical arrival and check-in time.

### Day 2 — Signature Kyoto Morning  (50/100)
*Golden: "Eastern Kyoto — Fushimi + Higashiyama"*
**✅ Hits:** Fushimi Inari Taisha scheduled early · Included Kiyomizudera Temple visit
**❌ Misses:** Back-to-back activities without rest following early starts.
**🚨 Worst mistake:** No scheduled rest time after early Fushimi Inari visit.

### Day 3 — Natural Beauties and Historic Insights  (40/100)
*Golden: "Arashiyama — Full Day"*
**✅ Hits:** Visit to Kinkaku-ji
**❌ Misses:** Combines Arashiyama travel with Sanjusangendo Temple, affecting district coherence. · Lacks inclusion of Tenryu-ji Temple.
**🚨 Worst mistake:** Combining Arashiyama with other districts in a single day.

### Day 4 — Cultural Immersion Day  (60/100)
*Golden: "Northern Kyoto — Temples and Castle"*
**✅ Hits:** Includes visit to Nijo Castle · Meals with cultural experiences
**❌ Misses:** Misses a morning start with Ryoan-ji Temple. · Heavy scheduling with little downtime.
**🚨 Worst mistake:** Starts the day without Ryoan-ji Temple, a common pair with Kinkaku-ji.

### Day 5 — Day Trip Exploration  (70/100)
*Golden: "Philosopher's Path + Central Kyoto"*
**✅ Hits:** Day trip exploration of Nara
**❌ Misses:** Misses evening Pontocho walk and meal anchor.
**🚨 Worst mistake:** Lack of Pontocho visit as an evening anchor point.

### Day 6 — Departure from Kyoto  (90/100)
*Golden: "Departure"*
**✅ Hits:** Respectful departure day discipline · No sightseeing planned
**🚨 Worst mistake:** None, well-executed departure plan.

## Top Failures
### 🚨 District-mixing scheduling  `critical`
The itinerary mixes multiple district activities in one day, leading to inefficient use of time and decreased experience quality.

**Prompt fix:** *Ensure each day's activities are confined to a single district to minimize travel time and maximize immersion.*

### ⚠️ Poor dawn timing for iconic sites  `major`
Crucial sites are not visited at dawn, missing the opportunity for quieter and more serene experiences.

**Prompt fix:** *Schedule key crowded sites like Arashiyama and Fushimi Inari for dawn missions to avoid crowds.*

### ⚠️ Lack of rest time  `major`
The schedule does not allow for adequate recovery time after early starts, causing potential traveler fatigue.

**Prompt fix:** *Include at least one unscheduled afternoon period on days starting before 07:00 to allow for resting.*

## What the AI Got Right
- Included Fushimi Inari Taisha and Arashiyama Bamboo Grove
- Respected departure day discipline
- Scheduled traditional Kyoto meals like kaiseki

## Prompt Improvement Plan
### Changes to `prompts/itinerary.md`
- Clearly define separate district days to avoid combining distant sites.
- Emphasize dawn-only scheduling for high-profile attractions to avoid overcrowding.
- Include rest periods in afternoons for days starting before 07:00.

### Changes to board/destination prompts
- Integrate local hidden gems suggestions like Jojakko-ji or Nanzen-ji's aqueduct for deeper experiences.
- Highlight the necessity of including iconic evening locations like Pontocho for a complete Kyoto experience.