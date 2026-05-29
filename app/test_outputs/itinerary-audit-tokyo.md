# Itinerary Audit — Tokyo, Japan
**Date:** 2026-05-28  
**Itinerary file:** `test_outputs/tokyo-patched_itinerary.json`  
**Trip context:** family_young, Sept 16–20, 2026 (arrive 09:00, depart Sept 21)  
**Itinerary stats:** 5 days, 10 activities  
**Auditor:** systematic row-by-row read of all 5 days

---

## Summary Verdict

| Severity | Count | Description |
|---|---|---|
| 🔴 Critical | 2 | Permanently closed venues scheduled as active |
| 🟠 Quality | 4 | Wrong location (teamLab), cross-city experience ID, geographic gap, wrong-theme dinner |
| 🟡 Minor | 3 | Wrong-season foliage, unverifiable dinner venue, 3-star kaiseki for young family |

**Headline:** Two of the five scheduled days contain permanently closed venues that will leave the family stranded. Day 2 sends them to Edo-Tokyo Museum (closed since 2022, not reopening until ~2028). Day 4 sends them to Oedo Onsen Monogatari Odaiba (permanently closed March 2021). Both closures were flagged in the board audit — the itinerary planner inherited the bad cards without catching them.

---

## 🔴 Critical Failures

### 1. Day 4 — Oedo Onsen Monogatari: permanently closed venue
**Row:** Activity 13:30–16:00, Day 4 (Sept 19)  
**Experience ID:** `spa_experience_oedo_onsen`  
**What the itinerary says:** "Relax at Oedo Onsen with family-friendly baths. Ensure you pack your swimwear."  
**Reality:** Oedo Onsen Monogatari at Odaiba permanently closed March 31, 2021. The brand continues at Atami, but the Odaiba venue is gone. A family traveling here will find an empty plot or repurposed building.  
**Cascade effect:** The entire Day 4 plan collapses. The morning teamLab activity (also affected, see below) and afternoon Oedo Onsen were clustered together as the "Odaiba Day" — with both activities broken, Day 4 has no substance.  
**Fix:** Replace with a functioning onsen experience: Thermae-yu in Shinjuku (open, large, family-accessible) or Spa LaQua at Tokyo Dome City (family-friendly, rain-proof). Pair with the corrected teamLab location in Azabudai Hills.

---

### 2. Day 2 — Edo-Tokyo Museum: closed for major renovation
**Row:** Activity 12:30–15:00, Day 2 (Sept 17)  
**Experience ID:** `edo-tokyo-museum`  
**What the itinerary says:** "Explore the history of Tokyo through immersive exhibits. Arrive in the early afternoon to avoid morning crowds."  
**Reality:** Edo-Tokyo Museum has been closed for large-scale renovation since April 2022. Expected reopening: approximately 2028. As of September 2026, it is almost certainly still closed.  
**Fix:** Replace with Sumida Hokusai Museum (already a `nearby_pairing` on the board card). Same Ryogoku neighborhood, open, excellent. Or Shitamachi Museum in Ueno (small, family-friendly, depicts pre-war Tokyo life).

---

## 🟠 Quality Issues

### 3. Day 4 — teamLab Borderless: wrong geographic cluster
**Row:** Activity 10:00–12:00, Day 4 (Sept 19)  
**Experience ID:** `teamlab-borderless`  
**What the itinerary says:** Routes the family to "Odaiba" for teamLab and then directly to Oedo Onsen ("short walk"). The cluster data confirms: `teamlab-borderless` → `spa_experience_oedo_onsen` paired with `walk_min: 10`.  
**Reality:** teamLab Borderless relocated from Odaiba to **Azabudai Hills** (Toranomon/Minato area) in February 2024. It is not in Odaiba. The 10-minute walk pairing with Oedo Onsen (Odaiba) is stale cluster data from the old location.  
**Cascade:** Lunch at DiverCity Tokyo Plaza (Day 4, 12:15–13:15) is also in Odaiba — the entire Day 4 geographic cluster assumes Odaiba as the base, which is wrong for teamLab.  
**Fix:** The Day 4 cluster should be rebuilt around Azabudai Hills. Pair teamLab Borderless with Roppongi Hills or Toranomon Hills for lunch, then a Shinjuku onsen in the afternoon.

---

### 4. Day 2 — `nishiki_market_exploration` ID on a Tokyo meal row
**Row:** Meal 11:00–12:00, "Lunch at Nakamise Dori Market," Day 2 (Sept 17)  
**Experience ID:** `nishiki_market_exploration`  
**What the itinerary says:** A Tokyo market lunch in Asakusa.  
**Reality:** `nishiki_market_exploration` is the Nishiki Market experience card from the **Kyoto** board — it maps to Nishiki Market (35.005, 135.769), which is in central Kyoto, roughly 500 km from Asakusa. This is cross-city contamination from the board generation step that survived into the itinerary. If this experience_id is used to render a map pin, it will place a pin in Kyoto while the traveler is in Tokyo.  
**Fix:** Re-map this meal row to a Tokyo market experience_id (`tsukiji-fish-market-food-tour` would be appropriate) or leave experience_id null if the intent is just "lunch at Nakamise Dori."

---

### 5. Day 5 — Mori Art Museum in Roppongi placed in "Ueno Museum Day" with insufficient travel time
**Row:** Activity 13:30–15:30, "Mori Art Museum," Day 5 (Sept 20)  
**Experience ID:** `mori-art-museum`  
**What the itinerary says:** Day titled "Cultural & Museum Day in Ueno." Morning at Tokyo National Museum (Ueno). Lunch at Ueno Park 12:15–13:15. Activity at Mori Art Museum starting 13:30.  
**Reality:** Mori Art Museum is at Roppongi Hills (Minato Ward) — approximately 35–45 minutes by transit from Ueno. The itinerary allows only **15 minutes** to travel from Ueno Park to Roppongi (13:15 → 13:30). This is physically impossible. The family would arrive at Mori Art Museum around 14:00–14:15 at best.  
**Fix:** Either (a) move Mori Art Museum earlier and skip the Ueno Park lunch, (b) replace with a second Ueno museum (National Museum of Nature and Science or Tokyo Metropolitan Art Museum, both on-site), or (c) add a 45-minute travel segment and start Mori Art Museum at 14:15.

---

## 🟡 Minor Issues

### 6. Day 3 — Autumn foliage at Inokashira Park: wrong season
**Row:** Activity 13:00–14:30, "Autumn Foliage at Inokashira Park," Day 3 (Sept 18)  
**Experience ID:** `kichijoji-autumn-foliage`  
**What the planning_note says:** "A perfect afternoon activity for young children with ample room to play."  
**Reality:** Autumn foliage (koyo) at Inokashira Park peaks in **late October to November**. On September 18, the park trees are fully green — no autumn colors. The experience_id correctly notes `best_time: "Late October to early November"` but the planner scheduled it anyway.  
**Fix:** The activity itself (visiting Inokashira Park) is still worthwhile for families — it's a beautiful park with a boat pond. Reframe as "Inokashira Park Family Afternoon" without the foliage framing. Or swap experience_id to a September-appropriate card.

---

### 7. Day 2 — Nihonryori RyuGin dinner: wrong suitability for family_young
**Row:** Meal 17:30–19:00, "Dinner at Nihonryori RyuGin," Day 2 (Sept 17)  
**Experience ID:** `kaiseki_cuisine_experience`  
**What the planning_note says:** "Book in advance, engage with staff about the menu."  
**Reality:** Nihonryori RyuGin is a 3-Michelin-star kaiseki restaurant. Dinner is a 10–14-course tasting menu, 2–3 hours, priced at ¥30,000–¥50,000+ per person. This is one of Japan's most refined dining experiences and strongly oriented toward adult couples. The `kaiseki_cuisine_experience` board card likely carries this or a similar venue. Scheduling a multi-hour premium tasting dinner on Day 2 for a family with a young child — who will be jet-lagged and overstimulated — is a suitability mismatch.  
**Fix:** Replace with a family-accessible kaiseki option (set lunch at a lower-tier kaiseki restaurant, ¥3,000–¥8,000 range) or a child-friendly Japanese dinner (robatayaki, soba, ramen). If the kaiseki experience is important, schedule it for an evening when the adults can arrange childcare.

---

### 8. Day 5 — "Shinjuku Sky Lounge" dinner: unverifiable venue
**Row:** Meal 17:00–18:30, "Dinner at Shinjuku Sky Lounge," Day 5 (Sept 20)  
**Planning note:** "Dine at Shinjuku Sky Lounge for incredible views — a memorable family dinner."  
**Reality:** "Shinjuku Sky Lounge" is not a clearly documented named restaurant. This could refer to Park Hyatt Tokyo's **New York Grill** (high-floor, spectacular views, ¥30,000+), the Keio Plaza Hotel rooftop area, or the Hyatt Regency's TK Skybar. The generic Maps URL (`query=Shinjuku+Sky+Lounge+Tokyo`) will not resolve to a specific venue.  
**Fix:** Name the specific restaurant. If the intent is panoramic Shinjuku views, Park Hyatt's New York Grill is the canonical choice (reserve 2–3 weeks ahead). For families, the Shinjuku NS Building 29F restaurant cluster has high views at more accessible price points.

---

## Day-by-Day Activity Count Compliance

| Day | Date | Activities | Meals | Pass/Fail |
|---|---|---|---|---|
| Day 1 | Sept 16 | 2 (Meiji Shrine, Takeshita St) | 2 | ✅ Pass |
| Day 2 | Sept 17 | 2 (Sensoji, Edo-Tokyo Museum*) | 2 | 🔴 Fail — closed venue |
| Day 3 | Sept 18 | 2 (Harmonica Yokocho, Inokashira) | 2 | ⚠️ Wrong-season foliage |
| Day 4 | Sept 19 | 2 (teamLab*, Oedo Onsen*) | 2 | 🔴 Fail — both venues broken |
| Day 5 | Sept 20 | 2 (Tokyo Nat'l Museum, Mori Art) | 2 | ⚠️ Travel gap to Mori |

*Broken experience — closed venue or wrong location.

---

## Priority Fix List

| Priority | Day | Issue | Action |
|---|---|---|---|
| 🔴 P1 | Day 4 | Oedo Onsen permanently closed | REPLACE with Thermae-yu (Shinjuku) or Spa LaQua |
| 🔴 P1 | Day 2 | Edo-Tokyo Museum closed for renovation | REPLACE with Sumida Hokusai Museum |
| 🟠 P2 | Day 4 | teamLab Borderless cluster is Odaiba, venue is Azabudai Hills | REBUILD Day 4 cluster around Azabudai Hills |
| 🟠 P2 | Day 4 | DiverCity lunch doesn't pair with Azabudai Hills teamLab | REPLACE with Azabudai Hills / Roppongi lunch |
| 🟠 P2 | Day 2 | `nishiki_market_exploration` ID is a Kyoto card | FIX experience_id to null or a Tokyo market card |
| 🟠 P2 | Day 5 | Mori Art Museum (Roppongi) placed 15 min after Ueno Park | ADD travel segment; shift activity to 14:15; or replace with Ueno museum |
| 🟡 P3 | Day 3 | Autumn foliage at Inokashira, September = no colors | REFRAME as park visit; remove foliage language |
| 🟡 P3 | Day 2 | Nihonryori RyuGin — 3-Michelin-star, wrong for family_young | REPLACE with accessible kaiseki lunch or family dinner |
| 🟡 P3 | Day 5 | "Shinjuku Sky Lounge" — unverifiable venue name | NAME specific restaurant (Park Hyatt New York Grill or equivalent) |

---

## Inherited Board Failures

These itinerary issues trace directly back to board-level failures documented in `board-audit-tokyo.md`:

| Board issue | Board severity | Itinerary impact |
|---|---|---|
| `spa_experience_oedo_onsen` — permanently closed | 🔴 P1 | Day 4 activity — entire afternoon broken |
| `edo-tokyo-museum` — closed for renovation | 🟠 P2 | Day 2 activity — 2.5-hour slot wasted |
| `teamlab-borderless` — stale Odaiba cluster | 🟠 P2 | Day 4 cluster built on wrong location |
| `nishiki_market_exploration` — Kyoto card in Tokyo board | Not in Tokyo board audit (Osaka audit) | Day 2 meal experience_id is cross-city |
| `kichijoji-autumn-foliage` — wrong season metadata | 🟡 P3 | Day 3 activity — wrong-season framing |

The board-level P1 fixes (remove closed venues) are a prerequisite for itinerary quality. The itinerary planner cannot select good cards if the board contains bad ones.
