# Itinerary Audit — Kyoto, Japan
**Date:** 2026-05-28  
**Itinerary file:** `test_outputs/kyoto-patched_itinerary.json`  
**Trip context:** family_young, Sept 21–26, 2026 (arrive 14:00, depart 11:00)  
**Itinerary stats:** 6 days, 9 activities  
**Auditor:** systematic row-by-row read of all 6 days

---

## Summary Verdict

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 0 | None — no closed venues, no hallucinated experiences |
| 🟠 Quality | 3 | Severely truncated days, missing meals across 4 days, afternoon gaps |
| 🟡 Minor | 2 | Wrong-season foliage at Nanzen-ji, overstated Ryōan-ji "breakfast" |

**Headline:** Kyoto's itinerary has no critical venue failures — the activities selected are all real, open, and appropriate for family_young. The structural problem is over-pruning: the Pass 2 reviewer correctly enforced the 2-activity-per-day cap but overcorrected, stripping activities without backfilling meals or afternoon content. Four of the six days contain no lunch or dinner rows, and three days end before noon with nothing planned for the afternoon. A family following this itinerary as written will have significant unstructured time on Days 2, 3, 4, and 5.

---

## 🔴 Critical Failures

**None.** All activities in the Kyoto itinerary resolve to real, operating venues suitable for a family with a young child.

---

## 🟠 Quality Issues

### 1. Days 2, 3, 4, 5 — missing meals across entire itinerary
**Scope:** Days 2 (Sept 22), 3 (Sept 23), 4 (Sept 24), 5 (Sept 25)  

| Day | Breakfast | Lunch | Dinner |
|---|---|---|---|
| Day 2 | ❌ | ❌ | ❌ |
| Day 3 | ❌ | ❌ | ❌ |
| Day 4 | ❌ | ❌ | ❌ |
| Day 5 | ❌ | Partial (Handicraft Center Café) | ❌ |

Day 1 has dinner (Kikunoi). Day 6 has breakfast (Ryōan-ji). Days 2–5 have essentially no meal rows outside one café lunch on Day 5.  
**Cause:** The change_log shows the Pass 2 reviewer removed 4 activities (Monkey Park, Boat Ride, Nijo Castle, Kyo-yuzen Dyeing, Philosopher's Path) to enforce the 2-activity cap. When activities were removed, the surrounding meal and travel rows appear to have been removed as well — or were never generated. The resulting structure is activity-heavy on planning but meal-empty.  
**Impact:** A family in Kyoto for 5 full days with no meal guidance will improvise, which may be fine for experienced travelers but defeats the purpose of a curated itinerary.  
**Fix:** Inject standard meal rows for Days 2–5. Kyoto has well-documented family-accessible options: Nishiki Market for lunch, Pontocho alley evening stroll with riverside dining, Arashiyama tofu restaurants, Fushimi Inari street food on the way back.

---

### 2. Days 2, 3, 4, 5 — severely truncated days ending before noon or early afternoon

| Day | Last scheduled activity ends | Afternoon coverage |
|---|---|---|
| Day 2 (Arashiyama) | 10:45 | ❌ nothing |
| Day 3 (Fushimi + Railway) | 12:00 | ❌ nothing |
| Day 4 (Nanzen-ji + Nat'l Museum) | 15:00 | ❌ nothing after |
| Day 5 (Nijo + Imperial Palace) | 13:45 | ❌ nothing after |

Day 2 is the most severe: activities end at 10:45 AM. The family is done with Arashiyama before lunch with no plan for the remaining 6–7 hours of the day.  
**Cause:** Same over-pruning as the meal issue. The change_log removed "Monkey Park Iwatayama" and "Boat Ride on the Hozu River" from Day 2 to comply with the 2-activity cap — correct enforcement — but the removed activities covered the afternoon block and were not replaced.  
**Fix:** Backfill afternoon content that doesn't add a third full "activity" slot. For Arashiyama (Day 2): add a Tenryu-ji garden walk (already in the itinerary at 08:45–10:45), then a Sagano area lunch and an afternoon stroll through Kimono Forest at Arashiyama Station or the Saga-Toriimoto preserved street. For Fushimi/Railway (Day 3): afternoon return to central Kyoto with Nishiki Market walk.

---

### 3. Day 4 — "Signs of Autumn at Nanzen-ji" with crimson momiji description: wrong season
**Row:** Activity 08:00–10:00, Day 4 (Sept 24)  
**Experience ID:** `signs-of-autumn-at-nanzen-ji`  
**What the notes say:** "Position yourself near the lower arches of the Suirokaku aqueduct to frame the crimson momiji against the weathered red brick."  
**Reality:** Autumn foliage (momiji) at Nanzen-ji peaks in **late November** (typically Nov 15–30). On September 24, the maple trees are entirely green. There will be no crimson momiji to frame. The board card for this experience was flagged as wrong-season in `board-audit-kyoto.md`.  
**Silver lining:** Nanzen-ji itself is worth visiting in September — the temple, aqueduct, and sub-temples (Tenjuan, Konchi-in) are excellent and the crowds are lighter than autumn peak. The experience is good, the seasonal framing is wrong.  
**Fix:** Reframe the card notes and planning_note. Remove "crimson momiji" and "autumn" language. Describe the experience accurately for late September: lush green canopy, quieter crowds, still water in Tenjuan's garden.

---

## 🟡 Minor Issues

### 4. Day 6 — "Breakfast at Ryōan-ji": overstated venue description
**Row:** Meal 08:00–09:00, "Breakfast at Ryōan-ji," Day 6 (Sept 26)  
**What the itinerary says:** "Enjoy a traditional Japanese breakfast with views of Zen gardens."  
**Reality:** Ryōan-ji does not have a traditional breakfast restaurant. The temple has **Seiryu-tei**, a small tea room that serves shojin ryori (temple cuisine), matcha, and light snacks — primarily a lunch and tea service, not a breakfast venue. Operating hours are typically from 08:00 with the temple itself, and light food is available, but "traditional Japanese breakfast with views of Zen gardens" overstates what is a modest tea room service.  
**Context:** This is Day 6 — departure day, check-out by 11:00. Going to Ryōan-ji for breakfast adds transit time in the wrong direction for most Kyoto accommodations. A hotel breakfast would be more practical for a departure morning.  
**Fix:** Change to hotel breakfast or a central Kyoto café (e.g., % Arabica in Arashiyama or around Gion). Or reframe: "Morning temple visit at Ryōan-ji with matcha and wagashi at Seiryu-tei tea room" — which is accurate and lovely, just not a full breakfast.

---

### 5. Day 1 — Kaiseki dinner at Kikunoi for a travel-weary family with a young child
**Row:** Meal 18:00–20:00, "Kaiseki Dining Experience at Kikunoi," Day 1 (Sept 21)  
**What the itinerary says:** "Introduce the family to Kyoto's elaborate culinary art with a Kaiseki dinner at Kikunoi. Secure a private room in advance."  
**Context:** Arrival day, arrival time 14:00. By 16:00 the family is in Gion. By 18:00 they're at Kikunoi for a 2-hour multi-course kaiseki dinner.  
**Concern:** Kikunoi Honten is a 3-Michelin-star kaiseki restaurant (¥25,000–¥40,000 per person). The arrival day — jet-lagged, overstimulated, with a young child who has been traveling — is the least ideal time for a high-stakes, extended-format dinner. Even with a private room, a small child sitting through 10+ courses over 2 hours on arrival night is a practical challenge.  
**Fix:** Move the kaiseki experience to Day 3 or 4 when the family is settled and less exhausted. Replace Day 1 dinner with something immediate and casual: Pontocho alley yakitori, Nishiki Market food stalls, or a simple tonkatsu dinner near the accommodation.

---

## Day-by-Day Activity Count Compliance

| Day | Date | Activities | Meals | Pass/Fail |
|---|---|---|---|---|
| Day 1 | Sept 21 | 1 (Gion District) | 1 (Kikunoi) | ✅ Pass — arrival day, limited time |
| Day 2 | Sept 22 | 2 (Bamboo Grove, Tenryu-ji) | 0 | ⚠️ No meals; day ends 10:45 |
| Day 3 | Sept 23 | 2 (Fushimi Inari, Railway Museum) | 0 | ⚠️ No meals; day ends 12:00 |
| Day 4 | Sept 24 | 2 (Nanzen-ji, Nat'l Museum) | 0 | ⚠️ Wrong-season foliage; no meals |
| Day 5 | Sept 25 | 2 (Nijo Castle, Imperial Palace) | 1 (café) | ⚠️ 1 meal; day ends 13:45 |
| Day 6 | Sept 26 | 0 | 1 (Ryōan-ji breakfast) | ✅ Pass — departure day |

---

## Priority Fix List

| Priority | Day(s) | Issue | Action |
|---|---|---|---|
| 🟠 P2 | Days 2–5 | No meal rows on 4 of 6 days | INJECT meal rows: Nishiki Market lunch, Pontocho dinner, Arashiyama tofu |
| 🟠 P2 | Days 2, 3, 5 | Days end at 10:45, 12:00, 13:45 with no afternoon plan | ADD afternoon content (not counted as activities): free temple walks, food stalls, covered arcade |
| 🟠 P2 | Day 4 | "Crimson momiji" language — wrong season for Sept 24 | REWRITE notes: remove autumn foliage framing; describe green Nanzen-ji accurately |
| 🟡 P3 | Day 6 | "Breakfast at Ryōan-ji" overstates a tea room | REFRAME as matcha-and-wagashi at Seiryu-tei, or switch to hotel breakfast |
| 🟡 P3 | Day 1 | 3-Michelin-star kaiseki on arrival night, family_young | MOVE kaiseki to Day 3–4; replace with casual arrival dinner |

---

## What the Kyoto Itinerary Gets Right

Despite the structural gaps, the activity selection is strong:
- **Day 2 (Arashiyama cluster):** Bamboo Grove at 08:00 + Tenryu-ji immediately after — textbook early-morning Arashiyama execution. Correct crowd-avoidance logic.
- **Day 3 (Fushimi Inari + Railway Museum):** Pairing a spiritual landmark with an explicitly child-friendly museum on the same day is excellent family_young planning. Railway Museum is one of the best indoor kid options in all of Japan.
- **Day 5 (Nijo Castle + Imperial Palace):** Two walkable northern Kyoto landmarks on the same day. Geographic clustering is correct. Nijo's "nightingale floors" are genuinely engaging for children.
- **All activities are real, open, and age-appropriate.** Unlike Tokyo's itinerary, no closed venues, no hallucinations. The underlying activity quality is the best of the three cities.

---

## Inherited Board Failures

| Board issue | Board severity | Itinerary impact |
|---|---|---|
| `signs-of-autumn-at-nanzen-ji` — wrong season metadata | 🟠 P2 | Day 4 notes describe nonexistent autumn foliage |
| `nijo-castle-exploration` — flagged as duplicate of `nijo-castle` | 🔵 P4 | Itinerary uses the duplicate ID; functionally correct but uses the weaker card |

The Kyoto board's core Signature experiences (Fushimi Inari, Bamboo Grove, Nijo Castle, Gion) are all clean, which is why the itinerary has no critical failures. Fixing the board's 2 P1 issues and the over-pruning behavior would make this the strongest itinerary of the three cities.
