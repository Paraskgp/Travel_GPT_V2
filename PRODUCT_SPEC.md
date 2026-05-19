# TravelGPT — Product Specification

**Version:** 0.2 · **Status:** Draft for review

---

## Phasing Overview

| Phase | What it does | External dependencies |
|---|---|---|
| **1.0** | Destination input → LLM → themed experience cards → JSON API | Claude only |
| **1.1** | Enrich each card with real-world data (photos, reviews, coordinates) | Google Places API |
| **2** | Stateless UI consuming the Phase 1 API | None beyond Phase 1 |
| **3** | Persistence — saved trips, preferences, history | Supabase / PostgreSQL |

Each phase is a working, shippable product. Later phases layer on top without breaking earlier ones.

---

## Phase 1.0 — LLM-Powered Experience Board (Backend Only)

### What it is

A single API endpoint. The user sends a destination and optional trip context. The API returns a structured JSON board of themed experience categories, each containing 10–15 curated experience cards. No database. No external search. One round-trip to Claude.

### Why this works without web search

Claude has deep embedded knowledge about destinations worldwide — major experiences, food scenes, local timing, seasonal patterns, what gets overcrowded, what is underrated. The value in Phase 1.0 is not sourcing new information. It is:

1. **Prompt design** — asking Claude the right questions in the right structure
2. **Context gathering** — collecting enough user context upfront to personalize well
3. **De-duplication** — prompting Claude to produce one canonical experience, not 12 operator variants
4. **Output structure** — returning a consistent, typed JSON schema the UI can rely on

The knowledge cutoff is an acceptable trade-off for Phase 1.0. Major destination experiences are stable. Freshness (new openings, closures, updated hours) is a Phase 1.1 concern handled by Google Places grounding.

---

### API Contract

#### Endpoint

```
POST /api/generate
```

#### Request Body

```json
{
  "destination": "Big Island, Hawaii",
  "preferences": {
    "dietary": ["vegetarian"],
    "interests": ["hiking", "food", "nature"],
    "party_type": "couple",
    "pace": "moderate",
    "budget": "mid",
    "duration_days": 7,
    "avoid": ["large crowds", "alcohol-centered"]
  }
}
```

`destination` is required. `preferences` is optional — the API returns a useful board even with just a destination name.

#### Response Shape

```json
{
  "destination": "Big Island, Hawaii",
  "destination_summary": "One or two sentences describing what makes this destination worth visiting and what defines it.",
  "themes": [
    {
      "id": "adventure",
      "name": "Adventure",
      "description": "One sentence describing this theme for this destination.",
      "experiences": [
        {
          "id": "manta-ray-night-snorkel",
          "name": "Manta Ray Night Snorkel",
          "summary": "One sentence.",
          "why_worth_it": "Why this experience matters for this destination.",
          "who_for": ["couples", "adventure seekers", "snorkelers"],
          "who_skip": "Not suitable for non-swimmers or anyone prone to seasickness.",
          "duration_hours": { "min": 2, "max": 3 },
          "effort": "moderate",
          "cost_band": "mid",
          "booking_difficulty": "reserve_ahead",
          "best_time": "evening",
          "avoid_when": "Rough seas — check conditions day-of.",
          "seasonal_notes": "Year-round, but manta activity peaks October–April.",
          "local_tip": "Kona side departures are more reliable than Kohala; book 2–3 weeks out.",
          "what_to_bring": ["swimsuit", "motion sickness band", "cash for tip"],
          "common_variants": "Some tours are snorkel-only, others offer scuba. Most include gear.",
          "watch_out_for": "Operators vary significantly in group size and guide quality.",
          "nearby_pairings": ["Magic Sands Beach", "Kona coffee farm visit"],
          "dietary_flags": [],
          "suitability_tags": ["romantic", "adventure", "night"],
          "personalization_note": null
        }
      ]
    }
  ]
}
```

`personalization_note` is populated when a card conflicts with preferences. Example: `"Contains meat — flagged for vegetarian preference."` It is `null` when there is no conflict.

---

### Themes

The LLM selects and orders themes based on the destination type. It does not return every theme for every destination — a national park will not have a nightlife theme; a beach town may not have an arts theme.

**Available theme pool:**

| Theme ID | Name |
|---|---|
| `signature` | Signature Experiences |
| `unique_local` | Unique & Local |
| `food_drink` | Food & Drink |
| `food_crawls` | Food Crawls, Markets & Neighborhoods |
| `adventure` | Adventure |
| `nature` | Nature & Scenic |
| `hiking` | Hiking & Outdoors |
| `culture` | Culture & History |
| `arts` | Arts & Workshops |
| `family` | Family-Friendly |
| `romantic` | Romantic & Special Occasion |
| `rainy_day` | Rainy Day |
| `nightlife` | Nightlife |
| `shopping` | Shopping & Markets |
| `day_trips` | Day Trips |
| `seasonal` | Seasonal & Time-Bound |

**Per theme:** 10–15 experience cards, ranked by relevance to the destination and the user's preferences.

---

### Prompt Design (Phase 1.0 Core Work)

The prompt pipeline has three responsibilities:

**1. Theme selection**
Given the destination and its type (city, island, national park, etc.), determine which themes apply and in what order.

**2. Experience generation**
For each theme, generate 10–15 canonical, de-duplicated experience cards. The prompt must explicitly instruct Claude to:
- Produce one card per underlying experience, not per operator
- Include local timing, crowd, and packing intelligence — not generic descriptions
- Flag dietary and suitability conflicts with the user's preferences
- Be specific: "arrive before 7am" beats "go early"

**3. Structured output**
Return valid JSON matching the schema above. Use Claude's structured output / tool-use mode to guarantee schema compliance.

---

### What Phase 1.0 Does Not Do

- No web search or live data retrieval
- No database reads or writes
- No authentication
- No photo or review data (Phase 1.1)
- No itinerary generation (later phase)
- No caching (acceptable for alpha; added in Phase 3)

---

## Phase 1.1 — Google Places Grounding

### What it adds

After Phase 1.0 generates experience cards, Phase 1.1 enriches each card with real-world data from the Google Places API. This grounds the LLM output and adds:

- **Photos** (up to 3 per experience)
- **Star rating** and **review count**
- **Opening hours**
- **Address / coordinates** (for mapping later)
- **Google Maps link**
- **Price level** (cross-reference against Claude's `cost_band`)

### How it works

A separate enrichment step runs after generation. For each experience card, the API:

1. Constructs a Places search query: `"{experience name} {destination}"` (e.g., `"Manta Ray Night Snorkel Kona Hawaii"`)
2. Calls Places API Text Search → gets top match
3. Calls Places API Details → gets photos, hours, rating, coordinates
4. Attaches the enrichment payload to the card

### Enrichment fields added to each card

```json
{
  "places_enrichment": {
    "place_id": "ChIJ...",
    "photos": ["url1", "url2", "url3"],
    "rating": 4.7,
    "review_count": 312,
    "opening_hours": ["Mon: 8am–6pm", "..."],
    "address": "123 Kona Bay Dr, Kailua-Kona, HI",
    "coordinates": { "lat": 19.6400, "lng": -155.9969 },
    "maps_url": "https://maps.google.com/?cid=...",
    "price_level": 2
  }
}
```

`places_enrichment` is `null` for cards where no confident Places match is found. The card still works without it.

### New endpoint

```
POST /api/enrich
```

```json
{
  "experiences": [
    { "id": "manta-ray-night-snorkel", "name": "Manta Ray Night Snorkel", "destination": "Big Island, Hawaii" }
  ]
}
```

Returns the same list with `places_enrichment` populated where available.

Alternatively, `/api/generate` can accept an `enrich: true` flag to run both steps in sequence and return a fully enriched board in one call.

---

## Phase 2 — Stateless UI

### What it is

A Next.js frontend that consumes the Phase 1 API and renders the experience board. No database. No authentication. All user state lives in `localStorage`.

### What the UI does

- Search input: user types a destination
- Optional preferences panel: dietary, interests, party type, pace, budget, trip length
- Board renders themed category rows, each with 10–15 experience cards
- User can select (keep) or dismiss each card
- Selected cards accumulate in a shortlist panel
- At the end: "Plan my itinerary" CTA (disabled / coming soon in Phase 2)
- Preferences and selections persist in `localStorage` — lost on clearing browser

### What Phase 2 does not do

- No user accounts
- No server-side state
- No sharing
- No itinerary generation

---

## Phase 3 — Persistence

### What it adds

- Supabase PostgreSQL database
- User authentication (Supabase Auth, magic link)
- Saved trips and shortlists
- Preference profiles that persist across devices
- Board caching (generated boards stored so Claude is not re-called on every visit)
- Shareable shortlist links
- Historical trip archive

This is where the data model from the earlier spec draft becomes relevant. It is out of scope until Phases 1 and 2 are validated.

---

## Experience Card Fields (Full Reference)

| Field | Type | Phase available |
|---|---|---|
| `id` | string | 1.0 |
| `name` | string | 1.0 |
| `summary` | string | 1.0 |
| `why_worth_it` | string | 1.0 |
| `who_for` | string[] | 1.0 |
| `who_skip` | string | 1.0 |
| `duration_hours` | {min, max} | 1.0 |
| `effort` | easy / moderate / strenuous | 1.0 |
| `cost_band` | free / budget / mid / premium | 1.0 |
| `booking_difficulty` | walk_in / reserve_ahead / hard_to_get | 1.0 |
| `best_time` | string | 1.0 |
| `avoid_when` | string | 1.0 |
| `seasonal_notes` | string | 1.0 |
| `local_tip` | string | 1.0 |
| `what_to_bring` | string[] | 1.0 |
| `common_variants` | string | 1.0 |
| `watch_out_for` | string | 1.0 |
| `nearby_pairings` | string[] | 1.0 |
| `dietary_flags` | string[] | 1.0 |
| `suitability_tags` | string[] | 1.0 |
| `personalization_note` | string or null | 1.0 |
| `places_enrichment.photos` | string[] | 1.1 |
| `places_enrichment.rating` | float | 1.1 |
| `places_enrichment.review_count` | int | 1.1 |
| `places_enrichment.opening_hours` | string[] | 1.1 |
| `places_enrichment.address` | string | 1.1 |
| `places_enrichment.coordinates` | {lat, lng} | 1.1 |
| `places_enrichment.maps_url` | string | 1.1 |
| `places_enrichment.price_level` | int | 1.1 |

---

## Open Questions

1. **Single call vs. streaming:** Should `/api/generate` return everything at once (simpler) or stream themes one at a time as Claude generates them (better UX for slow connections)? Proposal: start with single call; add streaming in Phase 2 if latency is a problem.
2. **Enrich flag vs. separate endpoint:** Should enrichment be an optional flag on `/api/generate` or always a separate `/api/enrich` call? Proposal: separate endpoint so Phase 1.0 stays clean and Phase 1.1 is truly additive.
3. **How many themes per destination?** Proposal: 6–10, LLM-selected and ordered. Cap at 10 to avoid board overwhelm.
4. **Itinerary CTA in Phase 2:** Show it as disabled with "coming soon" or hide it entirely? Proposal: show it disabled — sets user expectation for what's next.
