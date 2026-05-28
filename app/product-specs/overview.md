# TravelGPT — Product Overview

**Last updated:** 2026-05-27

---

## What this product does

TravelGPT is an AI travel curator. Given a destination, travel dates, and optional traveler preferences, it produces:

1. **A board** — a curated, themed collection of experiences at the destination. Each experience is a rich card with specific local intelligence: what it is, why it matters here, when to go, what most visitors get wrong, and practical logistics.

2. **An itinerary** — a day-by-day schedule built from the board. Geographically coherent, timed correctly, paced for real people.

TravelGPT is not a booking engine or a search engine. It is the well-traveled friend who has already done the research, cut the noise, and can hand someone a beautiful, opinionated, honest view of what to do — and why.

---

## Core principles

1. **De-duplication above all.** One card per underlying experience, ever. 40 tour operators running the same activity = one card.
2. **Specificity over generality.** A tip that could appear in a guidebook to a different city is not a tip. Everything must be impossible to detach from this specific place.
3. **Board is universal, itinerary is personal.** Experiences at a destination exist regardless of who is traveling. Party type and preferences are filters applied at itinerary planning time — not board generation time.
4. **Party type changes everything, not just ranking.** `family_young` produces a fundamentally different trip, not the same trip with kid-friendly notes added.
5. **Food is first-class.** A street food crawl or a sake distillery tour is as valid as any attraction.
6. **Honest tradeoffs.** If something is expensive, hard to book, physically demanding, or only good under specific conditions — say so.

---

## Modules

| Module | What it does |
|---|---|
| **Destination context** | Generates the soul, pillars, and stay recommendation for a destination |
| **Weather context** | Generates monthly climate data and travel implications |
| **Query generation** | Generates targeted search queries to ground the board in real-world data |
| **Search & scraping** | Executes queries via Tavily, fetches pages, strips HTML noise |
| **Experience extraction** | Extracts verified real-world experiences from search results |
| **Board generation** | Generates themed experience cards grounded in verified data |
| **Tip enhancement** | Rewrites generic tips into hyper-specific local intelligence |
| **Places enrichment** | Attaches Google Places metadata (rating, photo, coordinates) to cards |
| **Itinerary planning** | Builds a day-by-day schedule from the board |
| **Caching** | Stores pipeline outputs to avoid redundant LLM and API calls |
| **Eval framework** | Scores pipeline outputs against golden reference data |

Each module has a dedicated spec in `product-specs/[module].md` and a technical design in `implementation-plan/[module].md`.

---

## Data flow

```
User input (destination + dates + preferences)
    │
    ├─► Destination context  ──────────────────────────────────────────────────┐
    ├─► Weather context                                                          │
    │                                                                            ▼
    ├─► Query generation ──► Search & scraping ──► Experience extraction    Board generation
    │                                                                            │
    │                                                                            ▼
    │                                                                        Tip enhancement
    │                                                                            │
    │                                                                            ▼
    │                                                                        Places enrichment
    │                                                                            │
    └────────────────────────────────────────────────────────────────────────► Board
                                                                                 │
                                                                                 ▼
                                                              Clustering ──► Itinerary (Pass 1)
                                                                                 │
                                                                                 ▼
                                                                          Itinerary (Pass 2 review)
                                                                                 │
                                                                                 ▼
                                                                            Final itinerary
```

---

## What is not in scope (current)

- Booking or reservations
- Real-time pricing or availability
- Multi-destination trip planning (e.g. Grand Canyon + Page + Sedona as one trip)
- User accounts or saved itineraries
- Mobile-optimised UI
