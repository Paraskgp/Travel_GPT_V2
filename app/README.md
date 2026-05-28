# TravelGPT v2

AI travel curator. Give it a destination and dates — it builds a themed board of real, verified experiences and a day-by-day itinerary.

---

## Quick navigation

| I want to... | Go to |
|---|---|
| Understand what the product does | `product-specs/overview.md` |
| Understand a specific module | `product-specs/[module].md` |
| Understand how a module is implemented | `implementation-plan/[module].md` |
| Understand agent operating rules | `AGENTS.md` |
| See full architecture + tech stack | `implementation-plan/overview.md` |
| Run the pipeline step by step | `scripts/step-audit.ts` |
| Run an eval | See **Running evals** below |
| Warm the cache for a destination | `scripts/prefetch.ts` |
| See tracked open issues | `KNOWN_ISSUES.md` |

---

## Folder structure

```
product-specs/          What each module does and why (non-technical)
implementation-plan/    How each module works (technical design + unit tests)
app/
  app/api/              HTTP route handlers (thin — call lib/pipeline/)
  lib/pipeline/         All board pipeline logic
  lib/cache/            File-based cache module
  lib/llm/              LLM client (multi-provider, stage-based routing)
  lib/tavily/           Tavily search client
  lib/scraper/          HTML fetch + strip
  lib/places/           Google Places enrichment client
  lib/claude/           Prompt builders
  lib/utils/            Shared utilities (parseJSON)
  lib/types.ts          All TypeScript interfaces
  prompts/              LLM prompts as .md files
  scripts/              Dev tools: audit, eval, prefetch
  golden/               Human reference data for evals
  cache/                Runtime cache (gitignored except .gitkeep)
  test_outputs/         Board/itinerary outputs from test runs
  eval_outputs/         Eval results
AGENTS.md               Agent operating rules — read before touching code
```

---

## Local setup

```bash
cp .env.example .env.local
# Fill in: OPENAI_API_KEY, GOOGLE_AI_API_KEY, TAVILY_API_KEY, GOOGLE_PLACES_API_KEY

npm install
npm run dev
```

---

## Running the pipeline step by step (audit mode)

Each step calls the same production function the generate route uses. Cache behaviour is identical to production.

```bash
npx tsx scripts/step-audit.ts 1 "Zion National Park"                  # destination context
npx tsx scripts/step-audit.ts 2 "Zion National Park" "November 2026"  # weather context
npx tsx scripts/step-audit.ts 3 "Zion National Park"                  # query generation
npx tsx scripts/step-audit.ts 4                                        # Tavily search
npx tsx scripts/step-audit.ts 5                                        # page scraping
npx tsx scripts/step-audit.ts 6 "Zion National Park"                  # experience extraction
```

Steps 1–2 use and populate the real production cache.
Steps 3–6 save intermediate files for inspection (`.audit-*.json`).

---

## Running evals

```bash
# Grounding eval (checks experience extraction output)
npx tsx scripts/eval-grounding.ts cache/destinations/zion-national-park/experiences.json golden/zion_nov2026.json

# Board eval (checks board generation output)
npx tsx scripts/eval-board.ts test_outputs/<board_file>.json golden/zion_nov2026.json

# Itinerary eval
npx tsx scripts/eval-itinerary.ts test_outputs/<itinerary_file>.json golden/zion_nov2026.json
```

---

## Warming the cache

Requires `npm run dev` running (prefetch calls `/api/generate` via HTTP).

```bash
npx tsx scripts/prefetch.ts --status                         # show what's cached
npx tsx scripts/prefetch.ts "Zion National Park"             # warm one destination
npx tsx scripts/prefetch.ts                                  # warm all defaults
npx tsx scripts/prefetch.ts --invalidate "Zion National Park"  # clear cache
```

---

## Environment variables

| Variable | Required | Used by |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Board generation (GPT-4o) |
| `GOOGLE_AI_API_KEY` | Recommended | Cheap stages (Gemini 2.5 Flash) — falls back to OpenAI if missing |
| `TAVILY_API_KEY` | Yes | Search grounding |
| `GOOGLE_PLACES_API_KEY` | Optional | Places enrichment — silently skipped if missing |
| `ANTHROPIC_API_KEY` | Optional | Available as `provider=anthropic`, not routed by default |
