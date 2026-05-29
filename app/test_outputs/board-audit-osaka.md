# Board Audit — Osaka, Japan
**Date:** 2026-05-28  
**Board file:** `test_outputs/2026-05-28_13-05-17_osaka-japan.json`  
**Trip context:** family_young, Sept 26–30, 2026  
**Board stats:** 57 experiences, 12 themes  
**Auditor:** systematic read of all 57 cards

---

## Summary Verdict

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 1 | Kyoto brewery on Osaka board (cross-city contamination) |
| 🟠 Quality | 3 | Name mismatches, fabricated river cruise landmarks, null enrichment |
| 🟡 Minor | 2 | Rose garden timing, department store mapped as tasting bar |
| 🔵 Structural | 5 | Severe deduplication failures — 5 venues appear 2–3 times each |

**Headline:** Osaka has a structural deduplication problem that is worse than Tokyo or Zion. Five venues are represented by 2–3 cards each across different themes: Sumiyoshi Taisha (3×), Umeda Sky Building (3×), Kuromon Market (2×), Nipponbashi (2×), Namba Parks (2×). An itinerary planner that doesn't deduplicate will schedule the same physical location on multiple days. Fix the structural issues first — they represent the highest scheduling risk.

---

## 🔴 Critical Failures

### 1. Sake Brewery Tour — Kyoto brewery on Osaka board
**Card:** `sake-brewery-tour` — Food & Drink theme  
**What the board says:** "Sake Brewery Tour" — presented as an Osaka Food & Drink experience  
**Reality:** Places enrichment maps to **Gekkeikan Ōkura Sake Museum, Fushimi Ward, Kyoto** (247 Minamihamachō, Fushimi Ward, Kyoto). The local_tip explicitly says "Fushimizu-no-ido well" and "Fushimi's distinct sake profile" — Fushimi is a sake-producing district of Kyoto, not Osaka. Coordinates (34.929, 135.762) place this firmly in Kyoto, roughly 25 km from Osaka city center.  

This is the same cross-city contamination as `nishiki_market_exploration` appearing in the Tokyo board. The Fushimi sake brewery card from the Kyoto board was imported into the Osaka board unchanged.  
**Fix:** Remove this card from the Osaka board. Replace with a real Osaka sake or craft beer experience — e.g., Konishi Brewing (Itami, 30 min from Osaka), Minami-Osaka Craft Beer Scene, or a Dotonbori sake bar crawl.

---

## 🟠 Quality Issues

### 2. Amano Brothers Cocktail Training — name mismatch
**Card:** `amano-brothers-cocktail-training` — Unique & Local theme  
**What the board says:** "Cocktail Masterclass with Amano Brothers" — describes a small-group class where "the elder Amano-san" teaches a specific three-cut ice method.  
**Places enrichment:** Maps to **Bar Amaro** (Higashishinsaibashi). Bar Amaro is a real cocktail bar in Shinsaibashi, but there is no record of "Amano Brothers" as a named cocktail school or duo. The elaborate detail about "elder Amano-san" and his "three-cut method" reads as fabricated specificity.  
**Fix:** Verify whether Bar Amaro offers masterclasses under a named instructor. If not, replace the card with a real Osaka cocktail workshop (e.g., Bar Hermit Crab's tasting sessions, or a whisky masterclass at Suntory's Yamazaki Distillery which is a 45-min day trip).

---

### 3. Evening Cruise on Yodogawa River — unverifiable experience + wrong landmarks in tip
**Card:** `cruise-on-yodogawa-river` — Romantic & Special Occasion theme  
**What the board says:** "Evening Cruise on Yodogawa River" with romantic city views  
**What the local_tip says:** "Look towards the towering red Ferris wheel atop HEP Five and the Umeda Sky Building" from the cruise  
**Reality:** The Yodogawa River runs through northern Osaka, significantly north of the Umeda/HEP Five area. From a boat on the Yodogawa at coordinates (34.757, 135.562), the Umeda Sky Building is approximately 3–5 km away and largely not visible in a "iconic skyline vista." Additionally, an established evening dinner cruise specifically on the Yodogawa is not a well-documented standard tourist offering. The Okawa River (Tosabori) near Nakanoshima has documented cruise options; the Yodogawa does not.  
**Fix:** Replace with Okawa River (Nakanoshima) evening cruise — a real, bookable romantic boat experience in central Osaka with genuine views of the Central Public Hall and Nakanoshima.

---

### 4. Osaka Science Museum — null enrichment on mappable card
**Card:** `osaka-science-museum` — Family-Friendly theme  
**Issue:** `places_enrichment: null`, `coordinates: null`. The Osaka Science Museum is a real venue (Nakanoshima area) with a verified Google Place. The enrichment failed to populate.  
**Fix:** The Osaka Science Museum place_id is `ChIJH_5e4bDxAGAR...` (near Nakanoshima). Manually inject enrichment or re-run the enrichment step for this card.

---

## 🟡 Minor Issues

### 5. Nakanoshima Rose Garden — wrong season for trip dates
**Card:** `nakanoshima-rose-garden-stroll` — Romantic & Special Occasion theme  
**What the board says (watch_out_for):** "The garden can be less vibrant if not in full bloom"  
**Trip dates:** September 26–30  
**Reality:** Nakanoshima Rose Garden peaks in **May** and **October-November**. In late September, the summer roses have largely faded and the autumn flush hasn't begun. The `watch_out_for` subtly acknowledges this risk but doesn't say the garden will likely be out of season for this trip.  
**Fix:** Add explicit seasonal warning: "Roses peak in May and late October–November. Late September visitors will likely find the garden between bloom cycles."

---

### 6. Sake and Shochu Tasting — enrichment maps to department store, not tasting bar
**Card:** `sake-and-sochu-tasting` — Nightlife theme  
**What the board says (local_tip):** References "Hankyu Sake Museum" for seasonal nama-zake tastings  
**Places enrichment:** Maps to the entire **Hankyu Umeda Main Store** — a 15-floor department store. The "Hankyu Sake Museum" is a B1 sake section within the store, not a standalone tasting venue.  
**Fix:** Minor. The card is broadly correct — Hankyu Umeda's basement sake section is a real and good Osaka stop. But rename to "Sake Tasting at Hankyu Umeda Basement" to set accurate expectations. The local_tip's "Hankyu Sake Museum" framing overstates what is a retail floor.

---

## 🔵 Structural Issues — Deduplication Failures

### 7. Sumiyoshi Taisha — 3 cards, same shrine
- `sumiyoshi-taisha-morning-ritual` — Unique & Local: "Attend Morning Rituals"
- `sumiyoshi-taisha-shrine-visit` — Culture & History: "Visit Sumiyoshi Taisha Shrine"
- `sumiyoshi-taisha-taiko-performances` — Arts: "Sumiyoshi Taisha Taiko Drum Performances"

All three resolve to the same place_id and coordinates (34.612, 135.494). A traveler with 4 days in Osaka could be scheduled to visit Sumiyoshi Taisha three times. The Taiko performances are conditional events (not always on), the morning ritual is plausible as a separate card, and the shrine visit is the general experience.  
**Fix:** Keep `sumiyoshi-taisha-morning-ritual` in Unique & Local as the primary card (most distinctive). Merge the shrine visit details into it. Remove the standalone Culture & History card. Keep Taiko Performances in Arts only if performances can be confirmed to occur on standard September weekdays/weekends (they do occur, but on specific festival dates).

---

### 8. Umeda Sky Building — 3 cards, same building
- `sunset-view-from-umbrakion-rooftop` — Romantic: "Sunset View from Umeda Sky Building" *(ID has "umbrakion" — likely a hallucinated venue name that the content correctly identifies as Umeda Sky Building)*
- `umeda-sky-building-floating-garden` — Rainy Day: "Umeda Sky Building's Floating Garden Observatory"
- `discover-umeda-sky-building` — Shopping: "Discover Umeda Sky Building & Floating Garden Observatory"

All three share place_id coordinates (34.705, 135.490) = Umeda Sky Building. The Shopping card is the weakest fit — Umeda Sky Building is an observatory, not a shopping destination.  
**Fix:** Keep `sunset-view-from-umbrakion-rooftop` (Romantic) and `umeda-sky-building-floating-garden` (Rainy Day) — these represent genuinely different use cases (clear evening vs. atmospheric rain). Remove `discover-umeda-sky-building` from Shopping. Also fix the ID: rename `sunset-view-from-umbrakion-rooftop` to `sunset-view-umeda-sky-building` to remove the "umbrakion" artifact.

---

### 9. Kuromon Market — 2 cards, same market
- `kuromon-ichiba-market` — Food Crawls: "Kuromon Ichiba Market Tour"
- `explore-kuromon-market` — Shopping: "Explore Kuromon Ichiba Market"

Same coordinates (34.665, 135.506). Both describe the same market from different angles (food vs. shopping).  
**Fix:** Keep `kuromon-ichiba-market` in Food Crawls. Remove `explore-kuromon-market` from Shopping.

---

### 10. Nipponbashi Den Den Town — 2 cards, same area
- `nipponbashi-den-den-town` — Food Crawls: "Nipponbashi Den Den Town Gourmet Adventure"
- `explore-nipponbashi-den-den-town` — Shopping: "Explore Nipponbashi Den Den Town"

Same coordinates (34.659, 135.506).  
**Fix:** Keep `explore-nipponbashi-den-den-town` in Shopping (better fit). Remove the Food Crawls card unless the "late-night gaming crowd kushikatsu carts" can be verified as a real subcultural phenomenon there (plausible but unverified).

---

### 11. Namba Parks — 2 cards, same complex
- `namba-parks-shopping-mall` — Rainy Day: "Shop and Relax at Namba Parks"
- `explore-namba-parks` — Shopping: "Explore Namba Parks"

Same coordinates (34.662, 135.502). Namba Parks is an outdoor terraced mall — the "rainy day" angle is questionable anyway since most dining areas are semi-outdoor.  
**Fix:** Keep only in Shopping. Remove from Rainy Day and replace with a genuinely weather-proof Osaka option (e.g., the underground Whity Umeda or Crysta Nagahori shopping malls, or Osaka Aquarium Kaiyukan which is already on the board).

---

### 12. Kyoto Culture Escape — redundant day trip for this itinerary
**Card:** `kyoto-culture-escape` — Day Trips theme  
**Context:** This user has a dedicated 5-day Kyoto segment (Sept 21–26) immediately before Osaka. Including a "Cultural Escape to Kyoto" day trip in the Osaka board will likely confuse the itinerary planner and the user — they just came from Kyoto.  
**Fix:** Same recommendation as `osaka-city-tour` in the Kyoto board. Tag with `destination_overlap: true` so the planner can suppress it for multi-city trips where the destination is already covered.

---

## Priority Fix List

| Priority | Card ID | Action |
|---|---|---|
| 🔴 P1 | `sake-brewery-tour` | REMOVE — Kyoto brewery placed in Osaka board |
| 🟠 P2 | `amano-brothers-cocktail-training` | VERIFY venue/instructor; replace if unverifiable |
| 🟠 P2 | `cruise-on-yodogawa-river` | REPLACE with Okawa River (Nakanoshima) cruise |
| 🟠 P2 | `osaka-science-museum` | FIX null enrichment — add place_id and coordinates |
| 🟡 P3 | `nakanoshima-rose-garden-stroll` | ADD seasonal warning for September visitors |
| 🟡 P3 | `sake-and-sochu-tasting` | RENAME; fix "Hankyu Sake Museum" framing |
| 🔵 P4 | Sumiyoshi Taisha ×3 | REMOVE `sumiyoshi-taisha-shrine-visit` (Culture & History); merge into morning ritual card |
| 🔵 P4 | Umeda Sky Building ×3 | REMOVE `discover-umeda-sky-building` (Shopping); fix ID on romantic card |
| 🔵 P4 | `explore-kuromon-market` | REMOVE — duplicate of `kuromon-ichiba-market` |
| 🔵 P4 | `nipponbashi-den-den-town` (Food Crawls) | REMOVE — duplicate of Shopping card |
| 🔵 P4 | `namba-parks-shopping-mall` (Rainy Day) | REMOVE — duplicate; replace with Crysta Nagahori or Whity Umeda |
| 🔵 P4 | `kyoto-culture-escape` | SUPPRESS in itinerary when Kyoto is already a trip segment |

---

## Cross-City Pattern Summary

| Finding | Tokyo | Kyoto | Osaka |
|---|---|---|---|
| Cross-city venue placed in wrong board | 0 | 0 | **1 (Kyoto brewery)** |
| Permanently closed venues | **2** | 0 | 0 |
| Hallucinated venues | **1** | 0 | 1 (Amano Brothers) |
| Duplicate cards (same venue, multiple themes) | 2 | 2 | **5 venues, 9+ cards** |
| Null enrichment on mappable card | 1 | 0 | 1 |
| Wrong-season seasonal cards | 1 | 1 | 1 |

**Osaka's unique failure mode:** Structural duplication is the dominant issue. The LLM generates a thematic board and doesn't track which physical venues it has already used, resulting in the same shrine/building/market appearing independently in 2–3 themes. The deduplication logic needs to run at the board generation step, not just at the itinerary planning step.
