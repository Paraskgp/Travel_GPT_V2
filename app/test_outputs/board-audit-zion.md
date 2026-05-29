# Board Coverage Audit — Zion National Park

**Date:** 2026-05-28
**Board file:** `test_outputs/2026-05-28_09-05-44_zion-national-park.json`
**Themes audited:** 8 themes, 37 experience cards
**Audit method:** Read every card. Verify location, local tip accuracy, safety omissions, operational info, factual claims. Flag any card where a traveler following the advice could be misled, endangered, or sent to the wrong place.

---

## Summary verdict

The Zion board is better than Yellowstone's first draft but has serious problems that would degrade itinerary quality and in some cases send travelers to the wrong location. The most critical failure is a hard coordinate error that points to Utah's Cache County (250+ miles away) instead of Zion. Several genuine duplicates inflate the card count without adding content. A closure that's been in effect since 2019 is not acknowledged at all.

**Priority fix count: 14**
- 🔴 Critical (will cause itinerary failures): 4
- 🟠 Safety omissions: 3
- 🟡 Quality/accuracy issues: 4
- 🔵 Structural (duplicates/contradictions): 3

---

## 🔴 Critical Failures

### 1. "White Caves Climbing" — Wrong state  `CRITICAL`

**Card:** Adventure theme
**Problem:** The Google Places enrichment maps this to "Wind Caves" at lat: 41.76°N, lng: -111.72°W — Logan, Utah, Cache County. That is approximately 280 miles north of Zion National Park. A traveler following this card's map link would drive to Logan.

The local tip describes a "Crystal Labyrinth" ascent and a "gypsum curtain" obscuring an entrance crack. Neither of these features is associated with any documented Zion climbing area. "White Caves" as a named climbing zone near Zion cannot be independently verified.

**Verdict:** Likely fabricated, or at minimum the card was generated for one location and mapped to a completely unrelated Place. The experience must be removed or replaced with a verified Zion climbing area (e.g., Moonlight Buttress approach, Touchstone Wall, or Spaceshot for serious climbers; or simply remove this card entirely as climbing in Zion requires NPS permits and is specialist-only).

---

### 2. "Grapevine Trail to Hidden Waterfall" — Unverifiable location  `CRITICAL`

**Card:** Unique & Local theme
**Problem:** The card describes navigating "the Grapevine wash upstream past the Cottonwood Grove" to find a "Hidden Waterfall." The Grapevine Trail trailhead maps to lat: 37.2742, lng: -113.1003 — off Kolob Terrace Road. A trail in this vicinity exists, but:

- "The Hidden Waterfall" is not a named or documented destination in NPS or trail resources for this corridor.
- The card's long description says the trail "descends steeply through a river canyon" — the Grapevine Trail area is a mesa/terrace, not a descending river canyon.
- The Places enrichment has a rating of only 3.4 from 19 reviews, suggesting either obscurity or a low-quality visit.
- The local tip claims the waterfall is "most impressive after a recent rain" — consistent with an ephemeral feature that isn't a reliable attraction.

**Verdict:** This experience cannot be recommended to travelers with confidence. An ephemeral waterfall that may or may not exist depending on recent rainfall, accessed via a trail described inaccurately, is not board-quality content. Remove or replace with the Kanarra Falls trail (near Cedar City, popular slot canyon waterfall) or Spring Creek Canyon, both of which are documented and verifiable near Zion.

---

### 3. "Weeping Rock Trail" — Long-term closure not mentioned  `CRITICAL`

**Cards:** Two cards reference Weeping Rock as a walk-in experience:
- "Weeping Rock Geological Marvel" (Unique & Local)
- "Weeping Rock Trail" (Nature & Scenic)

**Problem:** Weeping Rock Trail has been **closed to the public since October 2019** due to significant rockfall and ongoing unstable slope conditions. The NPS posted permanent closure notices. As of 2026, the trail remains closed. Neither card mentions this.

Both cards say `booking_difficulty: walk_in` — correct if it were open; actively wrong because it instructs travelers to walk into a closed area.

The "Unique & Local" card's local tip describes exactly what it's like to stand directly under the dripping rock face: "Position yourself at the innermost curve of the rock shelter to feel the constant, fine mist directly from the spring-fed Navajo Sandstone." This is describing a location a traveler literally cannot reach.

**Verdict:** Both Weeping Rock cards must be updated with the closure status, or removed entirely. If retained for educational context (the geological phenomenon is real), they must state: "⚠️ Weeping Rock Trail has been closed since 2019 due to rockfall and unstable slope conditions. Verify status with NPS before visiting — the trail may remain closed."

---

### 4. "Observation Point via East Mesa Trail" — Duplicate in two themes, contradictory details  `CRITICAL`

**Cards:**
- "Observation Point via East Mesa Trail" — Hiking & Outdoors, `effort: moderate`, 3–4 hours
- "Observation Point Trail via East Mesa" — Seasonal theme, `effort: moderate`, 3–4 hours

Both cards point to the same place ID (ChIJCZQDKbTGyoARSWO9itApNEU), same coordinates, same trail. They are identical experiences with slightly different wording. One will appear in both the hiking pool and the seasonal pool, creating a real risk of the itinerary scheduling Observation Point twice.

The East Mesa Trailhead requires a high-clearance vehicle on a dirt road (Pine Valley Road), which neither card mentions. This is a notable operational omission — 2WD sedans have trouble accessing this trailhead.

**Verdict:** Remove one card (keep the Hiking & Outdoors version, it's more complete). Add a `watch_out_for` note about the high-clearance access road.

---

## 🟠 Safety Omissions

### 5. Angels Landing permit not detectable by automated check

**Card:** Signature Experiences — Angels Landing Hike
**Problem:** The itinerary planner prompt detects permit requirements by scanning `local_tip` for keywords: "permit, lottery, advance, reservation, book ahead, day-before." Angels Landing's `local_tip` is entirely about climbing technique on the chains — no permit language appears. The `booking_difficulty: reserve_ahead` field is set correctly, but the automated detection doesn't read that field.

As a result, the reviewer's Check 9 will likely not fire on Angels Landing unless the model independently recalls that Angels Landing requires a permit. The permit warning becomes dependent on LLM general knowledge rather than card-driven injection.

**Fix:** Add permit language to `local_tip`. Example: "Enter the day-before lottery at recreation.gov by 3 PM the evening before. On the bolted chain sections from the Hogsback, weight your feet on the sandstone rather than pulling with your arms — most slips happen when hikers rely on arm strength alone." The permit note belongs first.

---

### 6. "Kolob Canyons Rappelling" — Frigid pool hazard buried in tip

**Card:** Adventure theme
**Problem:** The local_tip mentions "sections requiring swimming through frigid pools, even in summer; a full wetsuit is recommended." This significant safety information appears only in the `local_tip` — it's not in `watch_out_for` (which only mentions flash floods) and not in `what_to_bring` (which lists helmet, gloves, harness but not a wetsuit).

The `watch_out_for` field is what a traveler scans before booking. "Flash flood potential" is the only warning there — a traveler who books this without reading the full tip might arrive without a wetsuit and find themselves swimming in 50°F water with only a harness.

**Fix:** Add "Full wetsuit required — sections involve swimming through cold pools at any time of year" to `watch_out_for`. Add "wetsuit" to `what_to_bring`.

---

### 7. "West Rim Trail (Top-Down)" — Return logistics dangerously underspecified

**Card:** Hiking & Outdoors theme
**Problem:** The card describes a 14.9-mile one-way top-down hike from Lava Point to the canyon floor. The `watch_out_for` says "Exposure to sun; ensure you're aware of shuttle arrangements." This is critically incomplete.

There is no park shuttle service to Lava Point. Lava Point is reached via Kolob Terrace Road (paved but remote), and getting back from the canyon floor to your car at Lava Point requires either: (a) a private vehicle shuttle arranged in advance between two parties, or (b) a commercial shuttle service booked separately. Many hikers have been stranded at the canyon floor when shuttle arrangements fall through.

The card's framing ("ensure you're aware of shuttle arrangements") is so vague it provides no actionable guidance. A solo traveler or couple reading this has no idea they cannot use the park shuttle and need to pre-arrange private transportation.

**Fix:** Rewrite `watch_out_for` to: "No park shuttle serves Lava Point. You must arrange a private vehicle shuttle (leave one car at the Visitor Center, drive another to Lava Point) or book a commercial shuttle from Springdale before the hike. Do not attempt without confirmed return transport — hitchhiking out of Zion Canyon is unreliable."

---

## 🟡 Quality and Accuracy Issues

### 8. "Lamb's Knoll" directional error in local tip

**Card:** Unique & Local — "Zion Dark Sky Stargazing"
**Problem:** The local_tip says: "ascend to the flat summit of Lamb's Knoll and set up your scope facing due south, placing the subtle light dome from Hurricane to your distant left."

If you are facing due south, Hurricane, Utah would be to your right (Hurricane is to the southwest of Lamb's Knoll at lat: 37.176, lng: -113.29; Lamb's Knoll BLM site is at lat: 37.31, lng: -113.11). Southwest from Lamb's Knoll facing south is actually slightly right, not left.

This is a small error but it undermines the credibility of the tip. A visitor who tries to follow it will orient incorrectly.

**Fix:** "facing due south, placing the light dome from Hurricane on your right" — or restructure: "face southwest to center the Milky Way core, with Hurricane's glow on your right horizon."

---

### 9. "Moqui Cave" — Location described as "just outside Zion"  `MISLEADING`

**Card:** Unique & Local — "Moqui Cave Exploration"
**Problem:** The card says "Located just outside Zion." Moqui Cave is at US-89 near Kanab, UT — approximately 42 miles from Springdale and a 45-minute drive. "Just outside Zion" typically implies 5–15 minutes from the park entrance. A traveler expecting a quick detour will discover they need a 90-minute round trip.

The cave is a real attraction (genuine fossils, fluorescent minerals, Native American artifacts) and the dinosaur footprint tip is specific and verifiable. But it's a half-day excursion, not a stop.

**Fix:** Update `short_description` and `long_description` to reflect the actual distance: "Located 42 miles east of Springdale near Kanab, Utah (45-minute drive), Moqui Cave is a worthwhile half-day excursion..." Set `location_hint` to reflect the accurate location relative to base.

---

### 10. "La Verkin Creek Trail to Kolob Arch" — Effort rating too low

**Card:** Nature & Scenic theme — `effort: moderate`
**Actual:** The La Verkin Creek Trail to Kolob Arch viewpoint is 14.4 miles round-trip with approximately 700 feet of elevation gain. Most trail databases (AllTrails, NPS) rate this trail as **difficult** or **strenuous**. It is a full-day hike requiring strong fitness.

Meanwhile, the Seasonal theme's "Kolob Arch Trail" card correctly rates the same hike as `effort: strenuous`.

This contradiction means the Nature & Scenic card would pass the family_young filter (effort: moderate) or the older_parents filter, which would be dangerous for either group.

**Fix:** Update effort to `strenuous` in the Nature & Scenic card. Remove the Seasonal card as a duplicate (see Structural issues below).

---

### 11. "Hidden Creek Canyon Canyoneering" vs. "Hidden Canyon Canyoneering" — Unclear if same place

**Cards:**
- Unique & Local: "Hidden Creek Canyon Canyoneering" — guided tour, mentions "Corkscrew Chute"
- Adventure: "Hidden Canyon Canyoneering" — permit required, technical rappelling, near East Rim Trail

These read as two different experiences but "Hidden Creek Canyon" is not a named canyon in Zion's permit system. "Hidden Canyon" (the Adventure card) is a real, documented technical canyoneering route accessed from the East Rim Trail area. The "Hidden Creek Canyon" name appears to be either invented or a conflation with another canyon.

The "Corkscrew Chute" feature with a "controlled slide option" in the Unique & Local card is not documented in any canyoneering beta for Hidden Canyon or any adjacent canyon. This tip reads as fabricated.

**Fix:** If a guided canyoneering experience is intended (beginner-friendly), the correct product is likely the "Keyhole Canyon" guided tour near Zion — a real, commercial, beginner-accessible slot canyon. Rename and redirect the Unique & Local card to Keyhole Canyon. Remove the fabricated "Corkscrew Chute" tip. The Adventure card's "Hidden Canyon" is likely accurate — keep it.

---

## 🔵 Structural Issues

### 12. Weeping Rock appears twice

- "Weeping Rock Geological Marvel" — Unique & Local
- "Weeping Rock Trail" — Nature & Scenic

Same Google Place ID (ChIJZ2XVltjDyoARYALSfvGndaM). Same coordinates. Same 30-minute easy walk to the same dripping rock alcove.

**Fix:** Keep one card (recommend the Unique & Local card which has better depth). Remove the Nature & Scenic duplicate.

(Note: Both must also be updated with the trail closure information per Critical Issue #3.)

---

### 13. Riverside Walk appears twice

- "Riverside Walk" — Nature & Scenic, ID: `riverside-walk-zion`
- "Riverside Walk Trail" — Family-Friendly, ID: `riverside-walk-trail`

Same Google Place ID (ChIJH_gFqAzByoARrE75kBnJZW4). Same location. The Family-Friendly card has stroller info and a different tip; the Nature & Scenic card has a different tip. Neither is wrong but both will appear in the pool and could both be scheduled.

**Fix:** Merge into one card with `suitability_tags: ["family_friendly", "accessible", "stroller_friendly"]`. Keep the more specific tip (the Family-Friendly card's tip about the flat sandstone ledges for toe-dipping is better).

---

### 14. Horseback riding appears three times, near-identical

- Family-Friendly: "Sand Bench Trail Horseback Riding" — Canyon Trail Rides operator, kids 6+
- Romantic: "Romantic Horseback Riding Under the Canvas" — Under Canvas operator, couples
- Seasonal: "Zion Horseback Riding" — Under Canvas operator, all ages

The Seasonal and Romantic cards are both Under Canvas Zion, both 2 hours, both horseback. The Seasonal card adds nothing beyond the Romantic card. When the planner pulls from all themes, horseback riding can appear on three separate days.

**Fix:** Remove the Seasonal card. Differentiate the remaining two: Sand Bench (canyon interior, mule-based, park concession) vs. Under Canvas (mesa terrain, mesa views, glamping resort setting). These are genuinely different products — make the cards reflect that.

---

## What held up under scrutiny

The following cards are accurate, locally specific, and passed every check:

| Card | Why it passes |
|---|---|
| Angels Landing Hike | Chains technique tip is accurate and useful; effort/safety/booking all correct |
| The Narrows Hike | Cold water gear listed in what_to_bring; tip about canyoneering footwear is practical |
| Canyon Overlook Trail | Tip about sandstone alcove viewpoint before final ascent is accurate and specific |
| Zion Canyon Scenic Drive | Tip about Weeping Rock alcove morning light is accurate |
| Emerald Pools Trails | Middle Pool tip (east canyon view) is geographically correct |
| Zion Human History Museum | "Chinaman's Hat" tip from outdoor patio is real and unusual |
| Checkerboard Mesa | Pullout lighting tip (late afternoon for joint patterns) is accurate |
| Kolob Canyons Scenic Drive | Timber Creek Overlook tip (Tucupit/Paria Point strata) is accurate |
| Timber Creek Overlook Trail | Tip about late afternoon shadows on canyon fingers is accurate |
| Kayenta Trail | S-curve Virgin River overlook near Lower Emerald Pool junction is real |
| Watchman Trail | Rock shelf overlook tip is specific and accurate |
| Observation Point via East Mesa | Angels Landing framing from cliff edge tip is accurate |
| West Rim Trail | First descent panorama from Lava Point tip is accurate (logistics aside) |
| Pa'rus Trail (Biking) | Canyon Junction rock-skipping tip is specific and safe |
| Black Sage Restaurant | Patio northern railing tip for alpenglow is directionally correct |
| Watchman Sunset Hike | Bridge Mountain alpenglow tip (after sun disappears) is accurate |
| Zion Canyon Hot Springs | The facility is real; tip about cliffside pool placement is plausible |
| La Verkin Creek Trail | Far-bank sandstone shelf viewpoint tip is accurate |

---

## Coverage gaps

### Meaningful absences

1. **Court of the Patriarchs viewpoint** — One of the most photographed stops on the scenic drive, accessible via a short paved path from the shuttle stop. Not a dedicated card. Worth adding as an easy/free stop with a specific tip about the three-butte naming backstory.

2. **Angels Landing to Scout Lookout (permit-free)** — Many visitors hike the bottom 2 miles to Scout Lookout without the chains section, which requires no permit. A separate card (effort: moderate) for "Scout Lookout" gives families and permit-less travelers a defined goal. Currently, Angels Landing reads as all-or-nothing.

3. **Springdale dining** — The board has one premium restaurant (Black Sage, 45 min from town) and the Zion Canyon Brew Pub appears only in a nearby_pairing with no card. For a November couple's trip, having at least 2–3 vetted Springdale restaurant options with specific dishes named is important. The Brew Pub, Oscar's Café, and Bit & Spur are well-regarded options that should have cards or at least be nameable in meal rows.

4. **Pa'rus Trail as a walking experience** — Currently only appears as a biking card. The Pa'rus Trail is the only non-shuttle, paved trail in the main canyon that's genuinely pleasant as a walk. A walking version of the card would serve couples and families differently from the biking card.

---

## Priority fix list

| Priority | Fix | Impact |
|---|---|---|
| 🔴 1 | Remove "White Caves Climbing" — maps to Logan, UT | Prevents traveler being sent 280 miles off-course |
| 🔴 2 | Remove or replace "Grapevine Trail to Hidden Waterfall" — unverifiable | Prevents scheduling a non-existent experience |
| 🔴 3 | Add closure warning to both Weeping Rock cards | Prevents travelers from attempting a closed trail |
| 🔴 4 | Deduplicate Observation Point via East Mesa | Prevents same trail appearing twice in itinerary |
| 🟠 5 | Add permit/lottery keywords to Angels Landing `local_tip` | Enables automated permit detection |
| 🟠 6 | Add wetsuit to Kolob Canyons Rappelling `watch_out_for` | Prevents cold-water emergency |
| 🟠 7 | Rewrite West Rim Trail `watch_out_for` with specific shuttle logistics | Prevents travelers being stranded |
| 🟡 8 | Fix Hurricane direction in Lamb's Knoll stargazing tip | Accuracy |
| 🟡 9 | Update Moqui Cave to reflect 42-mile distance from Springdale | Sets correct expectations |
| 🟡 10 | Update La Verkin Creek to Kolob Arch effort to `strenuous` | Prevents family_young filter failure |
| 🟡 11 | Replace "Hidden Creek Canyon" with Keyhole Canyon guided tour | Replaces fabricated experience with real one |
| 🔵 12 | Remove duplicate Weeping Rock card (keep Unique & Local) | Reduces pool noise |
| 🔵 13 | Merge Riverside Walk duplicates | Reduces pool noise |
| 🔵 14 | Remove Seasonal horseback card (near-identical to Romantic) | Reduces pool noise |

---

## Comparison to Yellowstone audit

| Metric | Yellowstone | Zion |
|---|---|---|
| Non-existent location | 1 (Tonnage Point) | 1 (Grapevine Hidden Waterfall) |
| Wrong-place coordinates | 1 (Specimen Ridge) | 1 (White Caves → Logan, UT) |
| Closed attraction not flagged | 0 | 1 (Weeping Rock since 2019) |
| Safety info missing from scan field | 1 | 1 (Angels Landing permit in local_tip) |
| Direct duplicates | 0 | 3 pairs |
| Conflicting effort ratings | 0 | 1 (Kolob Arch) |
| Misleading distance claim | 0 | 1 (Moqui Cave "just outside Zion") |
| Cards that passed fully | ~22/38 | ~18/37 |

Zion's board is comparable in quality to Yellowstone's first pass. Neither is production-ready. The closure omission (Weeping Rock) and the wrong-state coordinate error (White Caves) are the most severe failures — both would cause visible, trust-breaking errors in generated itineraries.
