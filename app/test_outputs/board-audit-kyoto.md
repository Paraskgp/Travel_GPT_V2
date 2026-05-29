# Board Audit — Kyoto, Japan
**Date:** 2026-05-28  
**Board file:** `test_outputs/2026-05-28_13-05-15_kyoto-japan.json`  
**Trip context:** family_young, Sept 21–26, 2026  
**Board stats:** 58 experiences, 12 themes  
**Auditor:** systematic read of all 58 cards

---

## Summary Verdict

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 2 | Wrong venue enrichment + closed-at-night venue |
| 🟠 Quality | 3 | Coordinate mismatch, wrong-season seasonal card, Pontocho duplicate |
| 🟡 Minor | 2 | Reservation requirement missing, timing risk on moon ceremony |
| 🔵 Structural | 3 | Nijo Castle duplicate, wrong theme placement, Osaka day-trip overlap |

**Headline:** Kyoto's board is cleaner than Tokyo and Zion — the core Signature experiences (Fushimi Inari, Kinkaku-ji, Gion, Arashiyama, Nishiki Market, Kiyomizu-dera, Philosopher's Path) are all accurate and well-enriched. Issues are concentrated in Rainy Day, Nightlife, and Seasonal themes, and in two specific venue enrichment mismatches.

---

## 🔴 Critical Failures

### 1. Kawai Kanjiro's House — museum not open at night
**Card:** `kawai-kanjirō-house-museum` — Nightlife theme  
**What the board says:** "Kawai Kanjiro's House at Night" — booking_difficulty: `walk_in`, local_tip describes "evening lighting subtly illuminates the surrounding earthen walls" and seeing pottery glow "unique to the night."  
**Reality:** Kawai Kanjiro's House (Kawai Kanjiro Kinenkan) is a museum in the former home of master potter Kawai Kanjiro. Operating hours are 10:00–17:00 (closed Mondays). It is not open at night. No "evening lighting" experience exists there. The entire card premise is fabricated — the museum closes hours before the "nightlife" window begins.  
**Fix:** Remove from Nightlife theme. If kept as a card, move to Arts or Culture & History and rewrite as a daytime heritage visit. The actual experience is a quiet, intimate 45-minute walk through a working potter's preserved home and kiln.

---

### 2. Tofu Sando Shop — Places enrichment maps to 3-Michelin-star kaiseki restaurant
**Card:** `tofu-sando-shop` — Food & Drink theme  
**What the board says:** "Tofu Sando Shop Excursion" — a casual food experience. local_tip mentions "Hyotei Tofu Sando" and eating by the pond at Tenjuan sub-temple.  
**Reality:** The Places enrichment maps to **Hyotei** — one of Kyoto's most prestigious restaurants, holding 3 Michelin stars and ranked among Japan's top kaiseki venues. Hyotei does not serve "tofu sandos" as a casual takeout item. A meal here costs ¥30,000–¥60,000+ per person. The card's premise of a casual, walk-in tofu sandwich shop does not match the venue.  
**Possible cause:** "Hyotei" may have a recent simplified lunch menu or bento offering that the LLM extrapolated, or the "tofu sando" concept was hallucinated and Hyotei was selected as the nearest tofu-focused establishment in the area.  
**Fix:** Either (a) replace with a real tofu shop (Otofu Morika or Tousuiro are well-known Kyoto tofu specialists), or (b) rework the card as a kaiseki entry at Hyotei with accurate booking difficulty (`hard_to_get`) and cost band (`premium`).

---

## 🟠 Quality Issues

### 3. Gosho Higashi Vegetable Market — enrichment maps to wrong venue
**Card:** `gosho-higashi-vegetable-market` — Unique & Local theme  
**What the board says:** A neighborhood vegetable market near the Kyoto Imperial Palace, selling Kyo-yasai (traditional Kyoto vegetables) like Kujo negi and Manganji togarashi.  
**Places enrichment:** Maps to **Higashi Hongan-ji** — a major Buddhist temple in Shimogyo Ward, roughly 1.5 km south of the Gosho Imperial Palace. These are completely different locations in different wards.  
**Additional concern:** "Gosho Higashi Local Vegetable Market" as a named entity is not a well-known Kyoto institution. The Nishiki Market (already on the board) is the recognized traditional market. The Shimogamo Shrine Vegetable Market (Tadasu no Mori) exists seasonally. "Gosho Higashi" may be a loosely invented name.  
**Fix:** Remove or replace. If a neighborhood market experience is needed, use the verified Nishiki Market (already on board as `nishiki-market`) or describe the Shimogamo area morning farmer's market.

---

### 4. Pontocho Alley duplicated across themes
**Cards:** `izakaya-experience` (Food & Drink) and `pontocho-alley-dining` (Nightlife)  
**Evidence:** Both cards share identical coordinates: `lat: 35.0039339, lng: 135.7710439` — both resolving to "Pontocho Alley." The experiences overlap in content: both describe dining/drinking in the same narrow lantern-lit alley, with river-facing seating.  
**Fix:** Remove `pontocho-alley-dining` from Nightlife. Keep `izakaya-experience` in Food & Drink as the primary Pontocho card. Add a brief nightlife note to its `long_description`.

---

### 5. "Signs of Autumn at Nanzen-ji" — wrong season for trip dates
**Card:** `signs-of-autumn-at-nanzen-ji` — Seasonal Highlights theme  
**What the board says (local_tip):** "frame the crimson momiji against the weathered red brick"  
**Trip dates:** September 21–26  
**Reality:** Autumn foliage (momiji) at Nanzen-ji peaks in **late November** (typically Nov 15–30). In late September, the maples are entirely green. A visitor will see no "crimson momiji." The `best_time` field and `local_tip` both describe a November experience, not September.  
**Fix:** Flag card as October-November only. The planner should suppress this for September trips. Same pattern as Tokyo's `kichijoji-autumn-foliage` issue — the Seasonal theme needs date-range metadata to prevent wrong-season recommendations.

---

## 🟡 Minor Issues

### 6. Sento Gosho Imperial Garden — reservation requirement understated
**Card:** `sento-gosho-garden-walk` — Unique & Local theme  
**What the board says:** booking_difficulty: `walk_in`  
**Reality:** The Kyoto Sento Imperial Palace requires either advance reservation via the Imperial Household Agency website or same-day application at the Kunaicho Kyoto Office (which often reaches capacity by mid-morning). It is NOT a simple walk-in. Walk-up visitors under 18 can enter with an adult, but the accompanying adult requires a reservation.  
**Fix:** Change booking_difficulty to `reserve_ahead`. Add to `watch_out_for`: "Advance reservation required via the Imperial Household Agency website (sankan.kunaicho.go.jp). Same-day spots fill by 10am."

---

### 7. Moon-Viewing Ceremony at Daikaku-ji — timing risk for September 21–26 trip
**Card:** `moon-viewing-ceremony-at-daikakuji` — Seasonal Highlights theme  
**What the board says:** booking_difficulty: `reserve_ahead`  
**Reality:** The Kangetsu-no-Yu moon-viewing ceremony at Daikaku-ji occurs annually around the harvest moon (usually 15th night of the 8th lunar month), which in 2026 falls around **September 10**. For a trip arriving September 21, the ceremony will have already concluded.  
**Fix:** Add to `watch_out_for`: "The ceremony typically occurs around September 10–15; for a Sept 21–26 trip, this experience will not be available. Verify exact dates before building an itinerary around it."

---

## 🔵 Structural Issues

### 8. Nijo Castle duplicated across themes
- `nijo-castle` — Culture & History theme — "Nijo Castle"
- `nijo-castle-exploration` — Family-Friendly Activities theme — listed separately

Both are Nijo Castle (41 Nijōjōchō, Nakagyo Ward). The Places enrichment for both will resolve to the same venue. An itinerary planner that doesn't deduplicate could schedule Nijo Castle on two separate days.  
**Fix:** Remove `nijo-castle-exploration` from Family-Friendly. Add `family_friendly` to the suitability_tags of the primary `nijo-castle` card and note the Ninomaru Palace "nightingale floors" as kid-friendly in the card description.

---

### 9. Kawai Kanjiro's House — wrong theme placement (see Critical #1)
Museum operating 10:00–17:00 placed in Nightlife. Even if the content were corrected, this card belongs in Arts or Culture & History. Remove from Nightlife regardless of content fix.

---

### 10. Osaka City Tour in Day Trips — overlap with dedicated Osaka leg
**Card:** `osaka-city-tour` — Day Trips theme  
**Context:** This user's trip includes dedicated Osaka days (Sept 26–30) with a full Osaka board. Showing an Osaka Day Trip in the Kyoto itinerary planner could lead to confusion: should Osaka Castle be done on the day trip from Kyoto or saved for the Osaka leg?  
**Fix:** Not a board-level fix — this is a planning UI concern. The itinerary planner should suppress Day Trip experiences to destinations the traveler has a dedicated segment for. Tag `osaka-city-tour` with `destination_overlap: true` so the planner can deprioritize it when Osaka is a subsequent stop on the same trip.

---

## Priority Fix List

| Priority | Card ID | Action |
|---|---|---|
| 🔴 P1 | `kawai-kanjirō-house-museum` | MOVE to Arts/Culture; REWRITE as daytime museum visit; REMOVE from Nightlife |
| 🔴 P1 | `tofu-sando-shop` | REPLACE with real tofu shop or REWORK as kaiseki at Hyotei |
| 🟠 P2 | `gosho-higashi-vegetable-market` | REMOVE or REPLACE with verified market experience |
| 🟠 P2 | `pontocho-alley-dining` | REMOVE from Nightlife — duplicate of `izakaya-experience` |
| 🟠 P2 | `signs-of-autumn-at-nanzen-ji` | ADD season metadata; suppress for September trips |
| 🟡 P3 | `sento-gosho-garden-walk` | UPDATE booking_difficulty to `reserve_ahead`; add reservation note |
| 🟡 P3 | `moon-viewing-ceremony-at-daikakuji` | ADD timing warning for trips after Sept 15 |
| 🔵 P4 | `nijo-castle-exploration` | REMOVE — duplicate of `nijo-castle`; add family_friendly tag to primary card |
| 🔵 P4 | `osaka-city-tour` | SUPPRESS in itinerary when Osaka is a subsequent trip segment |

---

## What Kyoto Gets Right

Unlike Tokyo (3 closed venues) and Zion (wrong-state coordinates), Kyoto's core board is strong:
- All 7 Signature experiences are accurate, well-enriched, and with real place_ids
- Fushimi Inari, Kinkaku-ji, Arashiyama, Kiyomizu-dera coordinates all verified
- Seasonal theme includes excellent September-appropriate cards: `moon-viewing-ceremony-at-daikakuji`, `early-autumn-cycling-along-kamo-river`, `savouring-september-kyo-kaiseki`, `early-autumn-hiking-at-mount-daimonji`
- Food tips (Nishiki Market yuba vendors, Fushimi sake water at Gokou-sui well, Pontocho riverside seats) are specific and plausible

The issues cluster in Nightlife (museum misplaced), Food & Drink (Hyotei mislabeled), and Unique & Local (unverifiable market). Fix those 4 cards and Kyoto is the cleanest board of the three cities.
