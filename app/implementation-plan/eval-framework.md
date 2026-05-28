# Implementation Plan: Eval Framework

## Owns

`scripts/eval-grounding.ts`
`scripts/eval-board.ts`
`scripts/eval-itinerary.ts`
`golden/*.json`

## Inputs / Outputs

```bash
npx tsx scripts/eval-grounding.ts <experiences.json|cache_dir> <golden.json>
npx tsx scripts/eval-board.ts <board.json> <golden.json>
npx tsx scripts/eval-itinerary.ts <itinerary.json> <golden.json>
# Each outputs a score JSON and markdown report to eval_outputs/
```

## Golden file format

```json
{
  "destination": "Zion National Park",
  "specs": {
    "grounding": {
      "required": ["Pa'rus Trail", "Angels Landing", "The Narrows", "Emerald Pools"],
      "min_count": 10,
      "required_categories": ["trail", "restaurant"]
    },
    "board": {
      "required": ["Angels Landing", "The Narrows", "Pa'rus Trail"],
      "forbidden": ["Cerulean Forest", "Crystal Springs"],
      "tier_coverage": true
    },
    "itinerary": {
      "max_activities_per_day": 3,
      "shuttle_required": true,
      "departure_discipline": true
    }
  }
}
```

## eval-grounding scoring

| Check | Weight | Method |
|---|---|---|
| Required experiences present | 40pts | Deterministic: name substring match |
| Minimum experience count (≥10) | 15pts | Deterministic: count |
| Category coverage (trail + restaurant) | 15pts | Deterministic: category field |
| key_facts quality (not fluffy marketing) | 30pts | LLM: samples 5, scores 0/1/2 per fact |

## eval-board scoring

| Check | Weight | Method |
|---|---|---|
| Required experiences on board | 30pts | Deterministic: name match across all themes |
| Forbidden experiences absent | 20pts | Deterministic: name match (any match = deduction) |
| Effort tier coverage per theme | 20pts | Deterministic: easy + moderate + strenuous present |
| local_tip specificity | 30pts | LLM: samples 5 tips, scores detach test pass/fail |

## eval-itinerary scoring

**Pass A — deterministic fact extraction (65%):**
- Activity count per day within pace bounds
- No activity after departure_time on final day
- Forced IDs present, skipped IDs absent
- Shuttle rows present for shuttle-required destinations
- Travel rows between distant consecutive activities

**Pass B — LLM quality judgment (35%):**
- Receives Pass A's extracted facts as ground truth (cannot hallucinate)
- Scores: planning note quality, day flow narrative, flexibility note presence, geographic coherence

## Running evals

```bash
# Grounding: read from cache
npx tsx scripts/eval-grounding.ts cache/destinations/zion-national-park/experiences.json golden/zion_nov2026.json

# Board: read from test output
npx tsx scripts/eval-board.ts test_outputs/2026-05-27_zion-national-park.json golden/zion_nov2026.json

# Itinerary: read from test output
npx tsx scripts/eval-itinerary.ts test_outputs/2026-05-27_zion-national-park_itinerary.json golden/zion_nov2026.json
```

## Unit tests

| Test | Covers success criterion |
|---|---|
| Deterministic checks produce identical score on identical input (run 3×) | Zero variance |
| Required experience present → full score; absent → zero score | Deterministic accuracy |
| Forbidden experience present → deduction; absent → no deduction | Forbidden check accuracy |
| LLM quality check score is bounded by pre-extracted facts | LLM cannot hallucinate |

## Open technical items

- No CI/CD integration — evals run manually
- `eval-grounding.ts` LLM quality check (key_facts scoring) is partially implemented — needs completion
- `eval-itinerary.ts` Pass B receives facts from Pass A but the handoff format is not yet validated against all edge cases
- No automated golden file generation — must be hand-authored
- `eval.ts` (legacy single-shot) still present — should be deprecated once atomic evals cover all cases
