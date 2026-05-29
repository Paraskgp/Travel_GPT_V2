# Board Audit — Tokyo, Japan
**Date:** 2026-05-28  
**Board file:** `test_outputs/2026-05-28_13-05-12_tokyo-japan.json`  
**Trip context:** family_young, Sept 16–21, 2026  
**Board stats:** 53 experiences, 11 themes  
**Auditor:** systematic read of all 53 cards

---

## Summary Verdict

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 3 | Permanently closed venues described as operating |
| 🟠 Quality/Safety | 4 | Wrong tip content, stale location, renovation risk |
| 🟡 Minor | 3 | Wrong-month seasonal card, null enrichment on mappable, night park safety |
| 🔵 Structural | 2 | Duplicate experiences across themes |

**Headline:** Three venues in this board are permanently closed. Robot Restaurant (2021), Oedo Onsen Monogatari Odaiba (2021), and "Oyreseas indoor windsurfing" (hallucinated venue, Places maps to an oyster restaurant). Anyone booking these will find nothing. Fix before any user sees this board.

---

## 🔴 Critical Failures

### 1. Robot Restaurant — permanently closed (2021)
**Card:** `robot-restaurant-show` — Rainy Day theme  
**What the board says:** Active entertainment venue with bookable shows, booking_difficulty: `reserve_ahead`, best_time: "Various shows from 16:00–21:00"  
**Reality:** Robot Restaurant in Shinjuku permanently closed in September 2021 during COVID. The venue has not reopened. The Places enrichment shows only 55 reviews with a low rating of 3.8 — consistent with an abandoned listing.  
**Fix:** Remove card entirely. Replace with an actual indoor Shinjuku entertainment option (e.g., TeamLab Planets TOKYO, Tokyu Kabukicho Tower observation area, or the Samurai Museum).

---

### 2. Oedo Onsen Monogatari Odaiba — permanently closed (2021)
**Card:** `spa_experience_oedo_onsen` — Romantic & Special Occasion theme  
**What the board says:** Active onsen spa in Odaiba, booking_difficulty: `walk_in`, describes outdoor Ashiyu Garden and paper lanterns.  
**Reality:** Oedo Onsen Monogatari at Odaiba permanently closed March 31, 2021. The spa brand continues at locations outside Tokyo (Atami, etc.) but the Odaiba venue is gone.  
**Places enrichment address:** "2-chōme-6-3 Aomi, Koto City" — the place_id returns the original Odaiba address with a residual listing.  
**Fix:** Remove card. Replace with a functioning onsen option: Thermae-yu (Shinjuku), Spa LaQua (Tokyo Dome City), or Shirohige's Cream Puff Factory if the romantic angle is needed.

---

### 3. "Indoor Windsurfing at Oyreseas" — hallucinated venue
**Card:** `indoor-windsurfing-in-oyreseas` — Adventure theme  
**What the board says:** Indoor windsurfing venue in Tokyo with instructor guidance and a "programmed wind sequence" fan array.  
**Reality:** "Oyreseas" does not appear to exist as an indoor windsurfing facility. The Places enrichment maps to **"Ostrea Oyster Bar & Restaurant - Roppongi"** — a seafood restaurant with no connection to windsurfing. The local tip ("largest central fan array," "ramps up from idle to full power") reads as fabricated technical detail.  
**Fix:** Remove card entirely. No verified indoor windsurfing venue with this name exists in Tokyo. Replace with a real adventure option if needed (e.g., a climbing gym in Shibuya like B-PUMP, or kayaking on the Sumida River).

---

## 🟠 Quality / Safety Issues

### 4. teamLab Borderless — nearby_pairings point to wrong (closed) location
**Card:** `teamlab-borderless` — Signature Experiences theme  
**What the board says:** `nearby_pairings: ["Palette Town", "Odaiba waterfront"]`  
**Reality:** The original teamLab Borderless was in Odaiba (Palette Town area) — that location closed in August 2022. The museum reopened in February 2024 at **Azabudai Hills** (Toranomon/Minato area). The Places enrichment correctly shows the new Azabudai Hills address. But the `nearby_pairings` still reference the old Odaiba location — travelers following these suggestions would be sent to the wrong part of the city, roughly 40 minutes away.  
**Fix:** Update `nearby_pairings` to: `["Azabudai Hills", "Toranomon Hills", "Roppongi Hills"]`. Also update `long_description` which still says "futuristic aesthetics" without mentioning the Azabudai relocation.

---

### 5. Harmonica Yokocho — local_tip describes wrong venue
**Card:** `kichijoji_harmonica_yokocho` — Unique & Local theme  
**What the board says (local_tip):** "seek out the original seafood stalls in the market's southwestern quadrant before late afternoon, then watch as they transition from fishmongers to standing-room-only izakayas."  
**Reality:** Harmonica Yokocho is a narrow post-war alley with 70–80 tiny bars and restaurants. There are no seafood stalls, no "market quadrant," no fishmonger-to-izakaya transition. This tip is describing a different venue — likely Tsukiji Outer Market, which has this characteristic. The body text about "shoulder to shoulder with locals" and "yakitori fresh off the grill" is correct but the local_tip is wrong.  
**Fix:** Replace local_tip with a correct Harmonica Yokocho tip, e.g.: "The alley's narrowest passage runs east of the main junction — follow it to find the smallest standing bars with just 4–5 stools each, most with hand-written menus and no English required."

---

### 6. Edo-Tokyo Museum — closed for major renovation
**Card:** `edo-tokyo-museum` — Arts & Culture theme  
**What the board says:** Active museum, booking_difficulty: `walk_in`, hours "10:00–12:00."  
**Reality:** The Edo-Tokyo Museum in Ryogoku closed for large-scale renovation in April 2022. The renovation is expected to run until approximately 2028. As of September 2026, the museum is almost certainly still closed.  
**Fix:** Add a `watch_out_for` note: "The museum has been closed for renovation since April 2022 and is not expected to reopen until approximately 2028 — verify status before visiting." Better fix: replace card with the nearby **Sumida Hokusai Museum** (open, smaller, excellent) as an alternative.

---

### 7. Edo-Tokyo Museum nearby_pairing partially compensates
Note: `Sumida Hokusai Museum` is already listed as a `nearby_pairing` for the Edo-Tokyo Museum card. If the museum is closed, the pairing becomes the primary suggestion — make it the primary card instead.

---

## 🟡 Minor Issues

### 8. Autumn Foliage (Seasonal) — wrong season for trip dates
**Card:** `kichijoji-autumn-foliage` — Seasonal theme  
**What the board says:** `best_time: "Late October to early November — for peak foliage colors"`  
**Trip dates:** September 16–21  
**Reality:** Autumn foliage in Tokyo peaks October–November. September visitors will see no foliage — Inokashira Park in mid-September is green summer foliage. This Seasonal card should not appear in a September itinerary plan.  
**Fix:** The itinerary planner should suppress this card for September trips. The card itself is correct — the problem is it should not surface for this travel window. Add `best_season: "october_november"` metadata so the planner can filter it.

---

### 9. Moonlit Walk Yoyogi Park — night park safety concern for families
**Card:** `moonlit_walk_yoyogi_park` — Romantic & Special Occasion theme  
**What the board says (local_tip):** "position yourself in the center of the Great Lawn after the last park rangers have completed their rounds"  
**Concern:** The tip explicitly suggests going to a large, dimly lit park after ranger supervision ends. For a `family_young` party, entering an unsupervised dark park with a young child at 20:00–21:00 is not appropriate. The watch_out_for says "limited lighting means staying on known paths is advisable after dark" — this partially acknowledges the risk but doesn't warn families away.  
**Fix:** Add `suitability_tags: ["couples_only"]` and remove `family_friendly`. Add to `watch_out_for`: "Not recommended for families with young children — limited lighting and no rangers after evening hours."

---

### 10. Cycling Along the Tamajina River — mappable with no enrichment
**Card:** `cycle-along-the-tamajina-river` — Adventure theme  
**What the board says:** `is_mappable: true`, `places_enrichment: null`  
**Issue:** Marked mappable but has no place_id or coordinates to render a pin. The river is a real cycling route (Tama River), not a single venue, which explains the null enrichment.  
**Fix:** Either set `is_mappable: false` or point the enrichment to a real starting waypoint (e.g., Futako-Tamagawa Station, place_id: `ChIJM11ib94KGGARK8r_z4JRsKs`).

---

## 🔵 Structural Issues

### 11. Shimokitazawa duplicated across themes
- `shimokitazawa_vintage_hunt` — Unique & Local theme — "Vintage Hunt in Shimokitazawa"
- `shimokitazawa-vintage` — Shopping theme — "Shimokitazawa Vintage Shops"

Both cards describe vintage shopping in the same neighborhood with nearly identical content. The local_tips differ slightly ("second-story entrances" vs. "look up or down") but both ultimately describe the same 2–3 hour vintage shop crawl in the same 2-block area.  
**Fix:** Remove `shimokitazawa-vintage` from Shopping (the weaker card). Keep `shimokitazawa_vintage_hunt` in Unique & Local where it belongs.

---

### 12. Takeshita Street duplicated across themes
- `takeshita-street-snack-pass` — Food Crawls, Markets & Neighborhoods theme — "Takeshita Street Snack Pass"
- `takeshita-street` — Shopping theme — "Takeshita Street, Harajuku"

Same street, same experience split across two themes with different emphasis (snacks vs. fashion). The itinerary planner could select both and schedule the same 150m street twice in one trip.  
**Fix:** Merge into a single card in Food Crawls. Add a `what_to_bring: ["cash for both snacks and shopping"]` note and combine the local_tips.

---

## Priority Fix List

| Priority | Card ID | Action |
|---|---|---|
| 🔴 P1 | `robot-restaurant-show` | REMOVE — permanently closed 2021 |
| 🔴 P1 | `spa_experience_oedo_onsen` | REMOVE — permanently closed 2021 |
| 🔴 P1 | `indoor-windsurfing-in-oyreseas` | REMOVE — hallucinated venue |
| 🟠 P2 | `teamlab-borderless` | UPDATE nearby_pairings and description to Azabudai Hills location |
| 🟠 P2 | `kichijoji_harmonica_yokocho` | REWRITE local_tip — current tip describes wrong venue |
| 🟠 P2 | `edo-tokyo-museum` | ADD closure warning or replace with Sumida Hokusai Museum |
| 🟡 P3 | `kichijoji-autumn-foliage` | ADD season metadata to suppress for September trips |
| 🟡 P3 | `moonlit_walk_yoyogi_park` | REMOVE family_friendly tag; add warning |
| 🟡 P3 | `cycle-along-the-tamajina-river` | FIX is_mappable flag or add place enrichment |
| 🔵 P4 | `shimokitazawa-vintage` | REMOVE — duplicate of shimokitazawa_vintage_hunt |
| 🔵 P4 | `takeshita-street` | REMOVE — duplicate of takeshita-street-snack-pass |

---

## Comparison vs. Previous Audits

| Issue Type | Yellowstone | Zion | Tokyo |
|---|---|---|---|
| 🔴 Critical | 4 | 4 | 3 |
| 🟠 Safety/Quality | 3 | 3 | 4 |
| 🟡 Minor | 4 | 4 | 3 |
| 🔵 Structural | 3 | 3 | 2 |
| Closed venues | 0 | 0 | **2 confirmed + 1 hallucinated** |
| Wrong-city content | 0 | 1 (White Caves, wrong state) | 0 |
| Wrong-venue tip | 1 | 0 | **1 (Harmonica Yokocho)** |
| Stale location data | 0 | 0 | 1 (teamLab) |

**Tokyo-specific pattern:** Urban destinations with rapidly evolving venue landscape (closures, relocations) expose a fundamental limitation — LLM training data can be 1–3 years stale, and venues like Robot Restaurant, Oedo Onsen, and teamLab have all changed status since 2021. The audit methodology should include a "closed venue" check pattern for well-known Tokyo entertainment venues.
