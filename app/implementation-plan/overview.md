# Implementation Plan — Overview

**Last updated:** 2026-05-27

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | API routes + React UI in one repo |
| Language | TypeScript (strict) | Type safety across pipeline |
| LLM — quality | GPT-4o (OpenAI) | Board generation — quality matters |
| LLM — cheap | gpt-4o-mini (OpenAI) | Cheap stages: $0.15/1M vs $2.50/1M for GPT-4o; falls back to Gemini 2.5 Flash if no OpenAI key |
| LLM — fallback | Gemini 2.5 Flash (Google) | Cheap-stage fallback when OPENAI_API_KEY unavailable |
| Search | Tavily API | $0.01/search, structured JSON, no HTML parsing |
| Scraping | Node built-in fetch | No extra dependency; sufficient for static pages |
| Places | Google Places API (Text Search + Details) | Rating, photo, coordinates, maps URL |
| Cache | Local filesystem (JSON files) | Simple, fast, zero infra; not horizontally scalable |
| Evals | Custom scripts (tsx) | Deterministic + LLM, run manually |

---

## Repository structure

```
app/
  app/api/
    generate/route.ts    ← Board pipeline entrypoint (thin)
    plan/route.ts        ← Itinerary pipeline (inline — refactor pending)
    enrich/route.ts      ← Places enrichment endpoint
    cache/route.ts       ← Cache status / prune
    places-photo/route.ts← Photo proxy (keeps API key server-side)

  lib/
    pipeline/            ← All board pipeline logic
      destination-context.ts
      weather-context.ts
      experiences.ts
      board.ts
    llm/client.ts        ← callLLM() with provider routing + stage hints
    cache/index.ts       ← cacheRead / cacheWrite / boardCacheKey / TTL
    tavily/client.ts     ← tavilySearch / tavilyBatchSearch
    scraper/client.ts    ← scrapeUrl / scrapeUrls
    places/client.ts     ← enrichExperience
    feedback/index.ts    ← append-only feedback persistence
    claude/prompts.ts    ← All prompt builders
    utils/parse-json.ts  ← Shared parseJSON<T>()
    types.ts             ← All TypeScript interfaces
    shortlist.ts         ← (check current usage)

  prompts/               ← All LLM prompts as .md files
    system.md
    destination-context.md
    weather-context.md
    query-generator.md
    experience-extractor.md
    themes/              ← Per-theme board generation prompts (12 files)
    distance-cluster.md
    itinerary.md
    itinerary-review.md

  scripts/
    step-audit.ts        ← Pipeline inspector (calls production functions)
    prefetch.ts          ← Batch cache warmer
    eval-grounding.ts
    eval-board.ts
    eval-itinerary.ts
    eval.ts              ← Legacy (high variance — use atomic evals)

  golden/                ← Human reference data for evals
  cache/                 ← Runtime cache (gitignored except .gitkeep)
  test_outputs/          ← Board/itinerary outputs from test runs

product-specs/           ← WHAT and WHY (module specs)
implementation-plan/     ← HOW (technical designs)
AGENTS.md                ← Agent operating rules
README.md                ← Navigation guide
```

---

## LLM provider routing

```typescript
// Cheap stages → gpt-4o-mini (if OPENAI_API_KEY set), else Gemini 2.5 Flash
const CHEAP_STAGES = [
  "destination_normalization", "query_generator", "experience_extractor",
  "experience_dedup", "tip_enhancement", "weather_context", "destination_context"
]

// Board generation → GPT-4o (quality matters)
// stage: "board_generation" → stays on passed provider (default: openai)
```

Within OpenAI, `resolveModel()` returns `gpt-4o-mini` for cheap stages and `gpt-4o` for all others. Routing is handled automatically by `resolveProvider()` and `resolveModel()` in `lib/llm/client.ts`. Callers pass a `stage` parameter — model selection is not their concern.

---

## Cost per destination (approximate)

| Operation | Cost |
|---|---|
| Query generation (gpt-4o-mini) | ~$0.001 |
| Tavily search (29 queries × $0.01) | ~$0.29 |
| Experience extraction (gpt-4o-mini, ~80K tokens) | ~$0.012 |
| Experience dedup (gpt-4o-mini) | ~$0.005 |
| Board generation (GPT-4o, ~8 themes × 2K tokens) | ~$0.20 |
| Tip enhancement (gpt-4o-mini, ~60 tips × 500 tokens) | ~$0.005 |
| **Total per fresh board** | **~$0.51** |
| **Repeat request (cache hit)** | **$0** |

---

## Module implementation files

| Module | product-specs/ | implementation-plan/ |
|---|---|---|
| Destination context | destination-context.md | destination-context.md |
| Weather context | weather-context.md | weather-context.md |
| Query generation | query-generation.md | query-generation.md |
| Search & scraping | search-grounding.md | search-grounding.md |
| Experience extraction | experience-extraction.md | experience-extraction.md |
| Board generation | board-generation.md | board-generation.md |
| Tip enhancement | tip-enhancement.md | tip-enhancement.md |
| Places enrichment | places-enrichment.md | places-enrichment.md |
| Itinerary planning | itinerary-planning.md | itinerary-planning.md |
| Feedback loop | feedback-loop.md | feedback-loop.md |
| Caching | caching.md | caching.md |
| Eval framework | eval-framework.md | eval-framework.md |
