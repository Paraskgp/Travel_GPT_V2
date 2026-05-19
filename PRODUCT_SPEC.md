# TravelGPT — Product Specification

**Version:** 0.4 · **Status:** Phase 2 shipped and deployed

---

## Status Snapshot (as of May 2026)

| Phase | What it does | Status |
|---|---|---|
| **1.0** | Destination input → LLM → themed experience cards → JSON API | ✅ Shipped |
| **1.1** | Enrich each card with photos, ratings, coordinates (Google Places) | ✅ Shipped |
| **2** | Stateless UI — board, map, spirit, weather, shortlist | ✅ Shipped (Vercel) |
| **2.5** | Prompt quality pass — destination specificity, location accuracy | 🔜 Next |
| **3** | Itinerary planning — day-by-day schedule from shortlisted experiences | 🔜 Next |
| **4** | Persistence — saved trips, user accounts, board caching | Later |

Live at: Vercel deployment (connected to GitHub `main` branch — auto-deploys on push).
Repo: `github.com/Paraskgp/Travel_GPT_V2`

---

## What Is Built (Phase 1.0 + 1.1 + 2)

### User flow

1. **Welcome screen** — landing page, single CTA to start
2. **Input form** — destination (required) + travel month (optional) + preferences (dietary, interests, party type, budget, pace, duration)
3. **Loading state** — "Building your board…" spinner while LLM generates
4. **Board** — four tabs:
   - **Experiences** — themed accordion sections, each with a horizontal card tray
   - **Spirit** — destination soul, defining pillars, best-for chips, honest notes
   - **Weather** — 12-month climate table; travel month row highlighted
   - **Map** — muted Google Maps with pins for enriched experiences
5. **Experience detail drawer** — slides in from right on card click: photo, rating, full description, tips, action buttons
6. **Shortlist** — ♥ like or ✕ dismiss any card; liked count shown in header; persists in `localStorage`

### API surface

```
POST /api/generate    → Board JSON (LLM-powered, ~15–45s)
POST /api/enrich      → Enriched experience list (Google Places, fire-and-forget from UI)
GET  /api/places-photo?ref=... → Proxied photo from Places API (keeps key server-side)
```

---

## LLM Pipeline Architecture

The generate call is a **4-node fan-out**:

```
User input
    │
    ├─► Node 1: Destination Context  ─────┐
    │   (soul, pillars, themes to run)    │
    │                                     ├─► (parallel)
    └─► Node 2: Weather Context  ─────────┘
               (12-month climate data)
                    │
                    ▼
        Fan out to N Theme Calls (parallel)
        ├─► signature
        ├─► unique_local
        ├─► food_drink
        ├─► culture
        ├─► nature
        └─► ... (LLM selects 6–10 themes per destination)
                    │
                    ▼
        Server-side deduplication
        (exact name match across themes)
                    │
                    ▼
             Board JSON → client
                    │
                    ▼ (background, fire-and-forget)
        /api/enrich (Google Places for mappable experiences)
```

**LLM:** OpenAI `gpt-4o` by default. Anthropic `claude-sonnet-4-6` supported via `provider` param.
**Timeout:** `maxDuration = 180s` on the generate route (Vercel Pro limit).

---

## Prompt Architecture

Three layers of prompt files (in `app/prompts/`):

| File | Purpose |
|---|---|
| `system.md` | Core curator persona, de-duplication rules, cross-theme uniqueness, output schema |
| `destination-context.md` | Prompt for Node 1 — generates soul, pillars, applicable_themes, honest_notes |
| `weather-context.md` | Prompt for Node 2 — generates 12-month climate table + travel implications |
| `themes/*.md` | One file per theme — specific instructions for what makes a good card in that category |

---

## Experience Card Schema (as shipped)

Key fields on each experience card:

| Field | Notes |
|---|---|
| `id` | kebab-case, unique per board |
| `name` | Clean display name |
| `short_description` | 1–2 punchy sentences for the card |
| `long_description` | 2–3 paragraphs for the detail drawer |
| `duration`, `effort`, `cost_band`, `booking_difficulty` | Metadata chips |
| `best_time`, `local_tip`, `watch_out_for` | Specificity fields |
| `location_hint` | Specific named place for Google Maps pin |
| `is_mappable` | true if location_hint resolves to a single Maps pin |
| `places_enrichment` | Populated by /api/enrich: coordinates, photo_url, rating, review_count, maps_url |
| `personalization_note` | Conflict with user prefs, or null |
| `tags`, `who_for`, `dietary_flags`, `suitability_tags` | Filtering metadata |

---

## Cross-Theme De-duplication

Because all theme calls run in **parallel**, the LLM cannot know what other themes will generate. Two-layer fix:

1. **System prompt rule:** "Each experience must appear in at most one theme."
2. **Server-side post-processing:** After all theme calls complete, iterate themes in order; filter any experience whose `name.trim().toLowerCase()` was already seen in an earlier theme. Empty themes are dropped.

Client keeps only ID-based dedup as a last resort (if LLM generates the same `id` twice).

---

## Phase 2.5 — Prompt Quality Pass (Next)

The biggest quality lever right now is prompt accuracy for **location specificity** and **destination handling**.

### Problem areas

**1. location_hint quality**
The map is only as good as the Places search that powers it. When `location_hint` is vague (e.g., "Higashiyama district" instead of "Kiyomizu-dera Temple"), the Places lookup returns a low-confidence or wrong match — or nothing. This leaves pins missing from the map.

Fix direction:
- Tighten the `location_hint` rule in `system.md` to require a specific named place, building, or street corner — never a neighborhood or area
- Add a confidence check in `/api/enrich`: if Places Text Search confidence is below threshold, return `null` rather than a wrong pin
- Consider a second LLM call to rewrite vague location hints into specific place names before sending to Places

**2. Destination disambiguation**
"Seattle" and "Seattle, WA" work fine. But "Pacific Northwest" or "Tuscany" or "Greek Islands" are regions — the LLM tends to spread cards across a huge geography, making the map and experience specificity worse.

Fix direction:
- Classify destination type (city / island / region / national park / neighborhood) in Node 1 (destination context)
- For regions: either (a) ask the user to pick a base city, or (b) generate sub-region sections with anchored locations
- For neighborhoods: zoom the board down to walking distance, skip day trip themes

**3. Theme quality per destination type**
Some themes are applied where they don't fit (e.g., "Hiking & Outdoors" for a dense city like Tokyo where "Hiking" means something very different than Yosemite hiking).

Fix direction:
- Add destination-type-aware theme filtering to the destination context prompt
- Add theme-specific examples in the per-theme prompt files that distinguish city vs. nature vs. island contexts

---

## Phase 3 — Itinerary Planning

### What it is

After a user has shortlisted experiences from their board (via ♥ likes), they click **"Plan my trip"**. The system takes their liked experiences and generates a **day-by-day itinerary** that:

- Groups experiences geographically (minimize travel time within each day)
- Respects timing constraints (morning experiences first, evening ones last)
- Respects effort level (doesn't front-load strenuous activities)
- Fills gaps with travel time estimates and meal suggestions
- Fits within the user's stated trip duration

### Inputs

- Liked experiences from the board (already have location coordinates, effort, duration, best_time)
- Trip duration (days) — already collected in preferences
- Base accommodation area (new input — needed for day-by-day geography grouping)

### New API endpoint

```
POST /api/plan
```

Request:
```json
{
  "destination": "Kyoto, Japan",
  "experiences": [...liked experience cards...],
  "duration_days": 5,
  "base_area": "Gion district"
}
```

Response:
```json
{
  "days": [
    {
      "day": 1,
      "label": "Eastern Kyoto",
      "experiences": [...ordered experience list...],
      "notes": "Heavy on temples — wear comfortable shoes."
    }
  ]
}
```

### UI

- New **Itinerary tab** in the board view (next to Spirit / Weather / Experiences / Map)
- Only active once the user has ≥ 3 liked experiences
- Day cards, each with an ordered list of experiences
- Each experience shows time estimate, travel time to next
- Export options: copy as text, PDF (later)

### CTA placement

A **"Plan my trip →"** button appears in the header once ≥ 3 experiences are liked. Currently shown in the liked count chip area. Clicking it navigates to the Itinerary tab and triggers the `/api/plan` call.

---

## Phase 4 — Persistence

Deferred until Phase 3 is validated. Adds:

- Supabase PostgreSQL + Auth (magic link)
- Board caching (don't re-call LLM for same destination)
- Saved trips across devices
- Shareable itinerary links
- Preference profiles

---

## Open Questions

1. **Destination type classification:** Should we classify on the client (from the input string) or in Node 1 (LLM decides)? LLM classification is more robust but adds a small latency cost.
2. **Itinerary LLM call:** One big call for the full itinerary, or one call per day? One call is simpler; per-day allows streaming individual days as they complete.
3. **Accommodation input for itinerary:** Required field or best-effort from destination center? Required is more accurate but adds friction.
4. **Map ↔ Itinerary integration:** Should the Map tab update to show the day-by-day route once an itinerary is generated?
