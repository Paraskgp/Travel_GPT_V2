# Itinerary Audit — Osaka, Japan
**Date:** 2026-05-28  
**Itinerary file:** `test_outputs/osaka-patched_itinerary.json`  
**Trip context:** family_young, Sept 26–30, 2026 (arrive Sept 26, depart Sept 30)  
**Itinerary stats:** 5 days, 7 activities  
**Auditor:** systematic row-by-row read of all 5 days

---

## Summary Verdict

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 0 | None — no closed venues, no hallucinated experiences |
| 🟠 Quality | 3 | Change_log contradiction, duplicate Osaka Castle area across days, venue misclassification |
| 🟡 Minor | 3 | Large afternoon gaps, misleading meal venue names, unplanned 3.5-hour block |

**Headline:** Osaka's itinerary is the cleanest of the three cities on venue quality — all 7 activities are real, open, and family-appropriate. The issues are softer: scheduling contradictions in the change_log, Namba Parks mislabeled as a restaurant, and large unplanned gaps on Days 3 and 4. The deduplication failures from the board (5 venues appearing 2–3×) are partially visible — `discover-umeda-sky-building` appears as a lunch venue and `explore-namba-parks` as a dinner venue, both of which are shopping/mall cards misused in meal contexts.

---

## 🔴 Critical Failures

**None.** All activities resolve to real, operating venues appropriate for a family with a young child.

---

## 🟠 Quality Issues

### 1. Day 1 — Change_log claims activities end before 18:00; Hozenji Yokocho ends at 19:00
**Row:** Activity 17:00–19:00, "Stroll Through Hozenji Yokocho," Day 1 (Sept 26)  
**Change_log entry:** "Check 1: Day 1 — adjusted schedule so no activities end after 18:00."  
**Reality:** The Hozenji Yokocho activity runs 17:00–**19:00**, ending 60 minutes after the claimed 18:00 cutoff. The change_log asserts a constraint was applied that visibly was not enforced.  
**Cause:** Likely a Pass 2 reviewer error — the log was written claiming a fix was made, but the activity end time was not actually adjusted.  
**Assessment:** For a family with a young child, ending an outdoor evening stroll at 19:00 in late September is reasonable (sunset in Osaka on Sept 26 is approximately 18:10, so 19:00 is post-sunset but the alley is lantern-lit). The 18:00 cutoff may be overly strict for this type of activity. But the change_log claiming a fix was made when it wasn't is a data integrity issue.  
**Fix:** Either update the activity end time to 18:00 (family exits Hozenji at dusk before lantern lighting) or correct the change_log to remove the false claim and acknowledge the 19:00 end is intentional for a lantern-lit evening experience.

---

### 2. Day 2 dinner — "Dinner at Namba Parks": shopping mall labeled as restaurant
**Row:** Meal 17:00–18:00, "Dinner at Namba Parks," Day 2 (Sept 27)  
**Experience ID:** `explore-namba-parks`  
**What the itinerary says:** "Admire how the rain washes the stone and amplifies the reflections of the shops below, creating a tranquil, subdued atmosphere."  
**Reality:** Namba Parks is a terraced outdoor shopping mall. It has restaurants within it (primarily on floors 5–6), but "Dinner at Namba Parks" is like saying "Dinner at the Mall of America" — it's a location, not a restaurant. The notes describe rain reflections ("tranquil, subdued atmosphere") — this is copied verbatim from the board card's Rainy Day theme framing, which is inapplicable here.  
**Additionally:** `explore-namba-parks` (Shopping) was flagged in `board-audit-osaka.md` as a duplicate of `namba-parks-shopping-mall` (Rainy Day). The itinerary uses the Shopping duplicate as a dinner venue — doubly misaligned.  
**Fix:** Name a specific restaurant within Namba Parks (e.g., the food halls on floor 5) or replace with a nearby Namba/Dotonbori dining experience. Remove the rainy-day notes text.

---

### 3. Day 3 lunch — "Lunch at Umeda Sky Building": observatory used as restaurant
**Row:** Meal 12:00–13:00, "Lunch at Umeda Sky Building," Day 3 (Sept 28)  
**Experience ID:** `discover-umeda-sky-building`  
**What the notes say:** "Enjoy the unique views while dining, preparing the family for an afternoon of creativity."  
**Reality:** Umeda Sky Building is primarily an observatory (the Floating Garden on floors 39–40). The basement (B1) does have Showa Koji, a themed retro food arcade with multiple small restaurants serving ramen, curry, and Japanese street food — a legitimate and family-friendly lunch option. However, the experience_id is `discover-umeda-sky-building` (the Shopping card), which the board audit flagged for removal as a mislabeled card. Using it as a "lunch venue" further misaligns the card.  
**The Showa Koji basement option is genuinely good for family_young.** The issue is card/ID hygiene, not the lunch location itself.  
**Fix:** Use the Showa Koji basement description explicitly: "Lunch at Showa Koji (Umeda Sky Building basement), a retro themed food arcade." Remove the observatory framing for a lunch context. Fix experience_id to null or a food-appropriate card.

---

## 🟡 Minor Issues

### 4. Days 3 and 4 — Large unplanned afternoon gaps
**Day 3 (Sept 28):** Activities end at 16:00 (Nakanoshima Museum). Dinner at hotel (17:00). One-hour gap only — acceptable.  
**Day 4 (Sept 29):** Activities end at 13:30 (Osaka Museum of History). Return to Namba by 14:00. Next event: dinner at 17:00. **3.5-hour afternoon gap with no planned content**.  
**Context:** "Nature and Relaxation Day" is the day title for Day 4 — the gap may be intentional (hotel rest for the family). The change_log does not explain it.  
**Fix:** Either (a) add a planning_note to the 14:00–17:00 block: "Unstructured afternoon: pool, hotel, or spontaneous Dotonbori stroll," or (b) add a light afternoon activity (Osaka's Den Den Town for the electronics/gaming district, a quick Shinsaibashi arcade visit, or a riverside walk along Nakanoshima).

---

### 5. Days 2 and 4 — Osaka Castle area visited on both days
**Day 2:** "Explore Osaka Castle" 09:30–11:30 (interior tour)  
**Day 4:** "Picnic at Osaka Castle Park" 10:00–11:00 (park grounds, `osaka-jo-koen`)  
**Assessment:** These are distinct experiences — the castle interior vs. the surrounding park. The board correctly has `osaka-castle-tour` and `osaka-jo-koen` as separate cards. For a 4-day city stay it's not unreasonable to be near the castle twice, especially since the park is adjacent to Osaka Museum of History (Day 4's second activity).  
**Minor concern:** The planning_note for the Day 4 Osaka Museum of History says "look east through the panoramic windows to connect the ancient capital's scale with Osaka Castle" — this makes the Day 4 cluster feel coherent. The repetition is defensible.  
**Fix:** No change required, but add a note on Day 4 acknowledging the repeat area: "You visited Osaka Castle on Day 2; today you're in the surrounding park — the approach from the east side reveals a different perspective."

---

### 6. Day 1 — Arrival logistics: late arrival meal at 15:30 is appropriate but check-in timing is ambiguous
**Row:** Meal 15:30–16:30, "Authentic Okonomiyaki Experience," Day 1 (Sept 26)  
**Context:** Day 1 is the last day of the Kyoto segment (depart Kyoto 11:00). Kyoto → Osaka by Shinkansen or local train is 15–20 minutes. Realistically the family arrives in Osaka by 12:00 noon, not 15:30.  
**Current gap:** 12:00 (arrive Osaka) → 15:30 (first activity) = 3.5-hour unstructured block, likely covering hotel check-in and transit. The planning_note says "After arriving in Osaka and checking into your accommodation, head to Okonomiyaki Mizuno in Dotonbori" — so check-in is assumed to be around 14:00-15:00. This is plausible for a 14:00 check-in standard.  
**Mild concern:** "After arriving in Osaka" language is vague — the family arrives in Osaka city around noon but hotel check-in is typically 15:00. The 3.5-hour gap should be acknowledged with a note (e.g., "store luggage and explore Dotonbori on foot before check-in").  
**Fix:** Add a planning_note for the 12:00–15:30 window: "Early arrival from Kyoto (travel ~15 min by Shinkansen). Hotel check-in typically 15:00 — store bags at the hotel and explore Dotonbori and Shinsaibashi on foot."

---

## Day-by-Day Activity Count Compliance

| Day | Date | Activities | Meals | Pass/Fail |
|---|---|---|---|---|
| Day 1 | Sept 26 | 1 (Hozenji Yokocho) | 1 (Okonomiyaki) | ✅ Pass — arrival day |
| Day 2 | Sept 27 | 2 (Osaka Castle, Aquarium) | 3 (breakfast, Kuromon lunch, Namba dinner) | ⚠️ Pass — Namba Parks misclassified as restaurant |
| Day 3 | Sept 28 | 2 (Kids Plaza, Nakanoshima Museum) | 3 (breakfast, Sky Building lunch, hotel dinner) | ⚠️ Pass — observatory used as lunch venue |
| Day 4 | Sept 29 | 2 (Castle Park, Museum of History) | 2 (Hoshino breakfast, Toyo Izakaya dinner) | ⚠️ 3.5-hour afternoon gap |
| Day 5 | Sept 30 | 0 | 1 (breakfast) | ✅ Pass — departure day |

---

## Priority Fix List

| Priority | Day | Issue | Action |
|---|---|---|---|
| 🟠 P2 | Day 1 | Change_log claims 18:00 cutoff applied; Hozenji ends at 19:00 | FIX change_log or adjust activity end time; clarify intent |
| 🟠 P2 | Day 2 | "Dinner at Namba Parks" — mall, not restaurant | RENAME to specific restaurant within Namba Parks; remove Rainy Day notes text |
| 🟠 P2 | Day 3 | "Lunch at Umeda Sky Building" uses Shopping observatory card | RENAME to "Lunch at Showa Koji (Umeda Sky Building basement)"; set experience_id to null |
| 🟡 P3 | Day 4 | 3.5-hour unplanned gap (14:00–17:00) | ADD planning_note: hotel rest or spontaneous Dotonbori/Shinsaibashi walk |
| 🟡 P3 | Day 1 | 3.5-hour arrival gap (12:00–15:30) unexplained | ADD planning_note: "Store bags, walk Dotonbori pre-check-in" |
| 🟡 P3 | Day 2/4 | Osaka Castle area appears on two separate days | ADD note on Day 4 acknowledging the return to the castle area with different lens |

---

## What the Osaka Itinerary Gets Right

- **Kids Plaza Osaka (Day 3):** Best family_young pick in the board. An entire floor dedicated to hands-on science and play. Correct morning placement — museums are better before lunch.
- **Osaka Aquarium Kaiyukan (Day 2):** One of the world's best aquariums. Excellent family choice. The pairing with Osaka Castle (morning) and Kuromon Market (lunch) on Day 2 gives the day energy without overloading it.
- **Toyo Izakaya (Day 4 dinner):** Real, famous Osaka institution. Chef Toyo-chan's live cooking show is genuinely engaging for children and adults. Excellent pick.
- **Fushimi Inari tip correctly placed in Osaka Aquarium notes** — the notes describe the whale shark tank at Kaiyukan correctly (bottom-most level, Pacific Ocean tank). No cross-city contamination in the key experience descriptions.
- **Departure day is well-paced:** Breakfast at hotel, checkout by 09:30, depart by 10:30 — plenty of buffer for the stated departure.

---

## Inherited Board Failures

| Board issue | Board severity | Itinerary impact |
|---|---|---|
| `explore-namba-parks` — Shopping duplicate flagged for removal | 🔵 P4 | Day 2 dinner — used as restaurant; wrong card type |
| `discover-umeda-sky-building` — Shopping card misclassified | 🔵 P4 | Day 3 lunch — observatory card used as meal venue |

The Osaka board's dominant failure mode (deduplication — 5 venues appearing 2–3×) shows up subtly in the itinerary: both `explore-namba-parks` and `discover-umeda-sky-building` are the "wrong" card from their duplicate pairs, selected by the planner over the better-fit cards. Fixing the board deduplication (removing the duplicate cards) would force the planner to use the correct primary cards.

---

## Cross-City Itinerary Summary

| Metric | Tokyo | Kyoto | Osaka |
|---|---|---|---|
| Closed venues in itinerary | **2** (Oedo Onsen, Edo-Tokyo Museum) | 0 | 0 |
| Wrong-season experiences | 1 (autumn foliage Sept) | 1 (momiji Sept) | 0 |
| Missing meals across itinerary | 0 | **4 days** of missing meals | 0 |
| Unplanned afternoon gaps | 1 | **3 days** end before noon | 2 |
| Venue misclassification | 1 (RyuGin) | 1 (Ryōan-ji breakfast) | 2 (Namba Parks, Sky Building) |
| Activity count violations | 0 | 0 | 0 |
| Geographic impossibilities | 1 (Mori Art Museum travel gap) | 0 | 0 |

**Overall ranking by itinerary quality:**
1. **Osaka** — Cleanest. No closed venues, no season errors, correct activity counts, good family picks.
2. **Kyoto** — Strong activity selection, zero venue failures, but severe over-pruning left the schedule nearly empty outside morning blocks.
3. **Tokyo** — Two permanently closed venues on the schedule. Day 4 is fully broken. Multiple geographic and quality issues compound the closed-venue failures.
