# Board Audit — Yellowstone National Park

**Date:** 2026-05-28
**Board file:** `test_outputs/2026-05-27_11-44-37_yellowstone-national-park.json`
**Themes:** 8 | **Experiences:** 38
**Auditor:** Self-critique (offline)

**Purpose:** Rate every experience card against the bar: *an itinerary planner that reads this card should have everything it needs to schedule, brief, and delight a traveler at this specific experience. No obvious gaps. No facts I could challenge. Local tips that a well-traveled guide would recognize as real.*

**Rating scale used in each section:**
- ✅ Passes — the card is accurate, complete, and useful as itinerary input
- ⚠️ Minor gap — usable but missing one important detail
- ❌ Fail — inaccurate, hallucinated, or would actively mislead a traveler

---

## Section 1 — Hallucinated or unverifiable facts  `CRITICAL`

These are the most dangerous failures. An itinerary that routes a traveler to a non-existent place, or gives a tip based on a made-up fact, causes direct harm to the travel experience and trust.

### 1.1 "Wildlife Photo Safari in Tonnage Point" — **location does not exist**  ❌

**What the board says:**
> Location: Tonnage Point, Yellowstone National Park

"Tonnage Point" is not a real location in Yellowstone National Park. The park has Specimen Ridge, Dunraven Pass, Hayden Valley, Lamar Valley, Soda Butte — no "Tonnage Point" appears on any NPS map or in any park documentation. This is a hallucinated place name.

A traveler who follows this card will spend time searching for a location that doesn't exist. Worse, an itinerary planner that reads "Tonnage Point, Yellowstone National Park" as a location will treat it as real.

**Impact:** HIGH — this experience should not be on the board. The underlying concept (wildlife photography) is valid but needs to be rebuilt around a real location (Hayden Valley Grizzly Overlook, Slough Creek pullout, etc.).

---

### 1.2 "Silent Walk at Artist's Paintpots" tip references a geyser that is not visible from there  ❌

**What the board says:**
> "As you approach the northern boardwalk section of Artist's Paintpots, look back towards Imperial Geyser in the distance..."

Imperial Geyser is in the Lower Geyser Basin, roughly 2 miles from Artist's Paintpots by road, in a different basin entirely. It is not visible from the Artist's Paintpots boardwalk.

This tip is geographically impossible. A traveler who spends time looking for Imperial Geyser from the Artist's Paintpots boardwalk will find nothing and lose trust in the app's accuracy.

---

### 1.3 "Backcountry Hike to Slough Creek" tip describes a "hidden thermal feature" near the campground  ❌

**What the board says:**
> "Start your backcountry hike to Slough Creek from the northeast edge of the Slough Creek Campground, where a less-traveled path reveals an unexpected thermal feature hidden behind a stand of lodgepole pines."

Thermal features in Yellowstone are well-mapped by the USGS and NPS for safety reasons. An "unexpected thermal feature hidden behind a stand of lodgepole pines" near a campground is either:
(a) a known feature not mentioned in park materials, which would be unusual, or
(b) a hallucination

Given that Yellowstone prohibits going off-trail near thermal areas specifically because of collapse risk, describing a hidden thermal feature accessible by an unmarked path is both unverifiable and potentially dangerous guidance.

---

### 1.4 "Museum of the National Park Ranger" — tip about telephone switchboard is likely fabricated  ❌

**What the board says:**
> "rangers often let children try connecting calls between park locations, which is a fun hands-on history lesson."

A mounted telephone switchboard exists in the museum (it is a historic ranger station). But "rangers often let children try connecting calls between park locations" is a very specific interactive claim. The museum is staffed by volunteers, is unstaffed much of the time, and is a self-guided historic building. This interactive activity is not documented anywhere and sounds hallucinated. A family who goes specifically for this and finds no ranger or no interactive experience is misled.

---

### 1.5 "Boiling River" — river name misspelled  ⚠️

**What the board says:**
> Location: "Boiling River, Yellowstone National Park"
> Tip: "just upstream from the main access point at the Gardiner River"

The river is the **Gardner River** (named after trapper Johnson Gardner). "Gardiner" is the name of the nearby Montana town. This is a persistent confusion but is factually incorrect in a card that should be authoritative.

---

## Section 2 — Safety omissions  `CRITICAL`

### 2.1 Yellowstone Lake Kayaking — no cold water / hypothermia warning  ❌

**What the board says:**
> Duration: Half day | best_time: 09:00–13:00 — calmer water and stable weather conditions

Yellowstone Lake is at 7,733 ft elevation. Water temperature ranges from 32°F to 60°F year-round — most of the summer it sits at 40–50°F. Capsizing into Yellowstone Lake means hypothermia within minutes.

The card mentions "calmer water" for morning timing, which is accurate — afternoon thunderstorms are dangerous. But there is **no cold water safety warning** anywhere on this card. For an experience that requires being on water in a small vessel at altitude with sub-50°F water temperature, this is a critical safety omission.

A complete card should say: "Yellowstone Lake water temperature stays near 40°F even in summer — wear a drysuit or wetsuit, not a life jacket alone. Capsizing causes rapid hypothermia. Morning departure essential as violent afternoon storms appear with little warning."

---

### 2.2 Boiling River — seasonal closure not mentioned  ❌

**What the board says:**
> Duration: 1–2 hours | best_time: 08:00–11:00

The Boiling River swimming area is **closed during high water conditions**, which typically means late May through mid-July. It is also permanently closed to soaking during spring runoff. For a May or early-summer trip (and this board is tagged to May 2026), the Boiling River may be entirely inaccessible.

A traveler who plans their itinerary around "Soak at the Boiling River" for a July trip, arrives, and finds it closed will be meaningfully disappointed.

The card should include: "Check NPS website before visiting — closed during spring high water (typically late May–July). Entrance requires a short walk from a gated parking area; the area also closes at dusk."

---

### 2.3 Specimen Ridge Trail — sends travelers off-trail via "barely-marked path"  ❌

**What the board says:**
> "Instead of starting your hike at the main trailhead, take the barely-marked path just past the Soda Butte Creek bridge on the northeast side..."

NPS regulations prohibit off-trail travel in Yellowstone's thermal areas, and the regulation extends broadly. A "barely-marked path" in a geothermal region is a safety hazard. The tip essentially encourages travelers to navigate via an unofficial route in a zone where ground collapse into thermal features is a real risk.

This tip should be removed entirely. The Specimen Ridge Trail is well-documented via official trailheads.

---

## Section 3 — Coverage gaps  `HIGH`

These are experiences that a knowledgeable Yellowstone traveler would expect to find on a quality board and cannot — and that I could generate on my own, which means the board failed its completeness bar.

### 3.1 West Thumb Geyser Basin — completely absent  ❌

West Thumb is one of Yellowstone's most distinctive experiences: a geyser basin on the shore of Yellowstone Lake, where thermal features erupt directly into the lake. At certain viewpoints you can see both the geysers and the lake reflection simultaneously. Abyss Pool, Black Pool, and Fishing Cone (where historic visitors literally boiled fish they just caught) are here.

This is a 30-minute to 1-hour easy boardwalk walk, family-friendly, and unique globally. It is not on the board at all.

---

### 3.2 Upper Geyser Basin walk — absent despite Old Faithful being on the board  ❌

The Upper Geyser Basin is the densest concentration of geysers on Earth. The 1.3-mile boardwalk loop from Old Faithful takes in Castle Geyser, Beehive Geyser, Riverside Geyser, Morning Glory Pool, and dozens of others. Several of these geysers have predictable eruption schedules posted at the Visitor Center.

The board has "Old Faithful Geyser" (1 hour, single geyser) but not the Upper Geyser Basin walk (2–3 hours, major independent experience). A traveler who spends 1 hour at Old Faithful and leaves has missed Beehive Geyser (180 ft eruption, one of the most dramatic in the park), Castle (30-minute eruption, unique castle-shaped cone), and Morning Glory Pool (famous for its deep blue color).

These are not minor omissions. They are the substance of the experience around Old Faithful.

---

### 3.3 Wolf watching in Lamar Valley — not called out  ❌

The Lamar Valley Safari experience says:
> "Position yourself at the hitching posts near the Lamar River footbridge at dusk for a lesser-known vantage point where elk and bison often gather along the water's edge."

Lamar Valley is nicknamed "The Serengeti of North America" specifically because it is the best place in the continental United States to observe wild wolves. The 1995 wolf reintroduction happened here. Dedicated wolf-watchers come from around the world and bring spotting scopes.

The card mentions elk and bison. It does not mention wolves once. For the itinerary planner, this means the scheduling guidance (sunrise timing, scope rental, the presence of the Yellowstone Institute wolf-watcher community at pullouts) is completely absent. A traveler who goes to Lamar Valley for wolves will have no orientation from this card.

---

### 3.4 Steamboat Geyser at Norris — not mentioned despite being the world's tallest active geyser  ❌

The Norris Geyser Basin card focuses on Vixen Geyser. Steamboat Geyser — the world's tallest active geyser, with major eruptions reaching 300–400 feet — is not mentioned. Steamboat has erupted far more frequently since 2018 (multiple times per year after decades of dormancy). On any given Norris visit there is a meaningful chance of witnessing Steamboat's minor water phase or, rarely, a major eruption.

The card's Vixen tip is fine but Steamboat is the headline experience. Its absence from the card means the itinerary planner has no guidance about timing a Norris visit around Steamboat's eruption pattern.

---

### 3.5 Grand Prismatic Spring — overlook not in the main card  ⚠️

The "Grand Prismatic Spring" card describes the boardwalk experience only. The famous aerial view of Grand Prismatic — the image most people recognize from photos — requires taking the Fairy Falls trail and ascending a short bluff for the overlook.

The Fairy Falls Trail card does mention this: "climb the nearby bluff just west of Fairy Falls Trail to see the full spectrum of the Grand Prismatic Spring below." But these are two separate cards. A traveler who goes to Grand Prismatic Spring (the card) and doesn't know to combine it with Fairy Falls (a different card, in a different theme) will see the boardwalk view only — which is obscured by steam at close range and fundamentally different from the photograph that made the spring famous.

The Grand Prismatic Spring card should state: "The boardwalk view is close-range; the famous aerial image requires the Fairy Falls Trail overlook. Do both in sequence — start with the overlook (25 min from trailhead), then walk the boardwalk."

---

## Section 4 — Duplicate locations  `MEDIUM`

### 4.1 Artist's Paintpots appears twice

- "Silent Walk at Artist's Paintpots" (unique_local theme)
- "Artist Paintpots Walk" (nature_scenic theme)

These are the same 0.5-mile trail. One has a bad tip (hallucinated Imperial Geyser reference). The other has a different tip about the mudpot reflection. Two cards for the same location dilute both cards and confuse the itinerary planner — it may schedule both.

**Fix:** Merge into one card, keep the valid tip, discard the Imperial Geyser tip.

---

### 4.2 Biscuit Basin appears twice

- "Biscuit Basin Loop Walk" (family_friendly theme)
- "Spring Birdwatching at Biscuit Basin" (seasonal theme)

Biscuit Basin is a small thermal area (0.6-mile loop). Both cards are at the same location. The birdwatching card is reasonable as a differentiated seasonal experience, but both being in an itinerary simultaneously would be redundant.

---

### 4.3 Beartooth Highway appears twice

- "Beartooth Highway Scenic Drive" (day_trips theme)
- "Autumn Foliage Drive along Beartooth Highway" (seasonal theme)

One is year-round, one is autumn-specific. The seasonal differentiation is valid, but both point to the same road. The tips reference different stops (Twin Lakes Vista vs Top of the World Store). These could be merged into one card with a seasonal note.

---

## Section 5 — Card-level quality issues  `MEDIUM`

### 5.1 Old Faithful — best_time misleads on how to use the eruption schedule

**What the board says:**
> best_time: Every 90 minutes — check eruption schedule at Visitor Center

The 90-minute interval is an approximation. Old Faithful's actual interval varies from 60 to 110 minutes depending on duration of the previous eruption. The NPS predicts the next eruption to within 10 minutes, and this is posted at the Visitor Center and on the NPS app.

The card's best_time essentially means "show up and wait up to 90 minutes." A better instruction: "Arrive at the posted prediction time, not 90 minutes after you arrive — check the NPS Yellowstone app or the Visitor Center board for the current prediction."

---

### 5.2 Historic Dinner at Old Faithful Inn — reservation requirement absent  ⚠️

The Inn's dining room is one of the most sought-after restaurant reservations in the national park system. Tables book out 6+ months in advance during summer. A traveler who reads this card and plans to "have dinner at the historic inn" without a reservation will be turned away.

The card must state: "Reservations required — book through Xanterra at yellowstonenationalparklodges.com. Peak summer reservations open 6 months in advance and sell out within hours of becoming available."

---

### 5.3 Backcountry Hike to Slough Creek — duration "half day" is wrong for backcountry  ⚠️

Slough Creek's signature backcountry experience requires hiking beyond the first meadow (accessible in an hour) to reach the remote upper meadows where wolves and bears are most reliably observed. This is 5+ miles each way and requires a backcountry permit and campsite reservation. "Half day" misrepresents the experience entirely.

If the intent is the first meadow only (day hike, no permit), that should be stated. If the intent is genuine backcountry travel, the card needs permit requirements, duration correction (at minimum full day, preferably 2–3 days), and gear requirements.

---

### 5.4 Bechler River Trail — 3–4 day backcountry with no permit or gear information  ❌

The Bechler River Trail is one of Yellowstone's most remote multi-day backcountry routes. It requires:
- A backcountry use permit (limited, must be reserved in advance)
- Bear canister (required by NPS)
- Multiple river crossings (dangerous in early season)
- Camping gear for 3–4 nights

None of this appears on the card. "Duration: 3–4 days" with no other context is the only signal that this is anything other than a day hike. An itinerary planner that reads this card would schedule it as a day activity, which is impossible.

---

### 5.5 Lamar Valley tip references "hitching posts" that may not exist  ⚠️

**What the board says:**
> "Position yourself at the hitching posts near the Lamar River footbridge at dusk..."

The Lamar River Trail does have a footbridge. "Hitching posts" at this location are not documented. This is a specific navigational claim that may be fabricated — and if a traveler arrives and there are no "hitching posts near the footbridge," the tip is useless.

---

### 5.6 Grand Canyon of the Yellowstone — only Artist Point (South Rim) covered  ⚠️

The card only mentions Artist Point (South Rim viewpoint). The North Rim — with Lookout Point, Grand View, and Inspiration Point — offers arguably better views of the Lower Falls (closer, different angle) and is often less crowded. A traveler who only reads about Artist Point misses half the canyon experience.

The card should note: "Plan for both rims — Artist Point (South Rim) for the classic canyon composition; Lookout Point (North Rim) for the most direct Lower Falls view. Both in 2–4 hours."

---

### 5.7 Hayden Valley — grizzly bears not mentioned in the tip  ⚠️

**What the board says (tip):**
> "Position yourself at the Grizzly Overlook during early autumn; you might catch the sight of bison using the area as a crossing..."

The location is literally named "Grizzly Overlook" but the tip only mentions bison. Hayden Valley is the primary grizzly habitat in the park (alongside Lamar) and is one of the best places in North America to observe wild grizzly bears from a safe distance. The card misses this entirely.

---

## Section 6 — Positive findings

Not everything is a problem. These cards are strong:

| Card | Why it works |
|---|---|
| Firehole Lake Drive — White Dome Geyser | Specific, accurate eruption interval, actionable ("15–30 min, reliable") |
| Mount Washburn Summit Trail | Bighorn sheep at radio tower — accurate, specific, actionable |
| Cody, Wyoming Excursion | Chief Joseph Scenic Byway + Dead Indian Hill Overlook — real, specific, useful detour |
| Jackson, Wyoming Experience | "Brewpub parking area on Millward Street" — remarkably specific and practical local tip |
| Tower Fall Overlook | Short, accurate, honest about duration (30 min) |
| Junior Ranger Program | Bench near Lone Star Geyser Trail — specific and plausible |
| Summer Stargazing | Trout Creek pullout in Hayden Valley — good specific spot |
| Lamar Valley best_time | 06:00–09:00 and 17:00–20:00 — correct and actionable |

---

## Summary scorecard

| Category | Issues found | Severity |
|---|---|---|
| Hallucinated/non-existent locations | 1 (Tonnage Point) | 🔴 Critical |
| Hallucinated tips | 3 (Imperial Geyser, telephone switchboard, hidden thermal feature) | 🔴 Critical |
| Safety omissions | 3 (kayaking cold water, Boiling River closure, off-trail thermal zone) | 🔴 Critical |
| Coverage gaps | 5 (West Thumb, Upper Geyser Basin, wolf watching, Steamboat, overlook) | 🟠 High |
| Duplicate locations | 3 (Artist's Paintpots ×2, Biscuit Basin ×2, Beartooth ×2) | 🟡 Medium |
| Missing operational info | 3 (Inn reservation, permits, closures) | 🟠 High |
| Factual inaccuracies | 2 (river name, overlook completeness) | 🟡 Medium |
| Weak or generic tips | 4 (Lamar hitching posts, Bechler rainbow, Hayden grizzly missing, GC North Rim) | 🟡 Medium |

---

## Priority fixes

**Must fix before this board is used for itinerary planning:**

1. **Remove "Wildlife Photo Safari in Tonnage Point"** — non-existent location. Replace with a real wildlife photography experience at Hayden Valley's Grizzly Overlook or Slough Creek pullout.

2. **Rewrite "Silent Walk at Artist's Paintpots" tip** — remove Imperial Geyser reference, replace with accurate boardwalk tip. Consider merging with "Artist Paintpots Walk" duplicate.

3. **Add cold-water/hypothermia warning to Yellowstone Lake Kayaking** — water is 40–50°F year-round; this is a safety issue.

4. **Add seasonal closure to Boiling River** — closed late May–July during high water; must be on the card.

5. **Add reservation requirement to Historic Dinner at Old Faithful Inn** — 6 months advance booking required in summer; without this the card actively misleads.

6. **Add permit/gear requirements to Bechler River Trail** — 3–4 days multi-day backcountry without any permit/gear context is unusable as itinerary input.

7. **Fix Backcountry Hike to Slough Creek** — "half day" is wrong; clarify whether this is first meadow (day hike, no permit) or genuine backcountry.

8. **Remove the "barely-marked path" tip from Specimen Ridge** — encourages off-trail travel in geothermal zone.

**Should fix to reach quality bar:**

9. Add West Thumb Geyser Basin (unique experience, completely absent)
10. Add Upper Geyser Basin walk (the core experience adjacent to Old Faithful)
11. Add Steamboat Geyser to the Norris card
12. Add wolf watching specifics to Lamar Valley card
13. Add Grand Prismatic overlook direction to the main Grand Prismatic card
14. Add both rims to Grand Canyon of the Yellowstone card
15. Add grizzly bears to Hayden Valley tip
16. Fix Old Faithful best_time to use NPS prediction, not 90-min approximation
