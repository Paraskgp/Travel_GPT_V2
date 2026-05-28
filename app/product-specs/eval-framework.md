# Module: Eval Framework

## What it does

Scores pipeline outputs against golden reference data to measure quality, catch regressions, and validate that prompt changes are improvements. Three atomic evaluators, one per pipeline stage, each checking exactly one thing.

## Why three separate evals

A single LLM-as-judge eval produced 9–84 point variance on identical inputs. The judge hallucinated what it expected to see rather than what was actually there. The fix: separate deterministic checks (which have zero variance) from LLM quality checks (which are bounded by pre-extracted facts).

## The three evals

### eval-grounding — Stage 0.7 output
Checks whether search grounding produced the right verified experiences.
- Deterministic: required experiences present, category coverage, minimum count
- LLM: samples 5 key_facts to verify they are factual (not fluffy marketing copy)
- Weight: 70% deterministic / 30% LLM quality

### eval-board — Stage 2–4 output
Checks whether board generation produced the right experience cards.
- Deterministic: required/forbidden experiences, tier coverage, deduplication, mappability
- LLM: samples 5 local_tips for specificity (detach test)
- Weight: 70% deterministic / 30% LLM quality

### eval-itinerary — Stage planning output
Two-pass eval:
- Pass A (deterministic): activity count per day, timing violations, forced/forbidden compliance, shuttle rows, departure day discipline. Outputs a structured fact sheet.
- Pass B (LLM judgment): receives the extracted facts as ground truth — cannot hallucinate. Judges planning note quality, day flow, flexibility notes.
- Weight: 65% deterministic / 35% LLM quality

## Golden files

`golden/[destination].json` — human-authored reference data with:
- `specs.grounding.required` — experience names that must be in extraction output
- `specs.board.required` — experience names that must appear on the board
- `specs.board.forbidden` — experience names that must NOT appear (hallucination check)
- `specs.itinerary` — constraints: max activities per day, shuttle required, timing rules

## Success criteria

- Grounding eval: score ≥ 75/100 for any destination with a golden file
- Board eval: score ≥ 80/100 for any destination with a golden file
- Itinerary eval: deterministic checks 100/100 (zero tolerance for structural failures)
- Zero variance on deterministic checks across repeated runs on the same input

## Evaluation criteria (meta — how we evaluate the evals)

- Variance: deterministic checks must produce identical scores on identical inputs
- Accuracy: LLM judgment checks must agree with human assessment ≥80% of the time
- Coverage: every success criterion in each module's product spec should have a corresponding eval check

## Simplifying assumptions

- Evals are run manually — no CI integration yet
- Golden files are hand-authored — no automated golden file generation
- Grounding eval reads directly from `experiences.json` cache file — not re-run from search results

## Open items

- No CI/CD integration — evals are not automatically run on every commit or prompt change
- No automated golden file updates when the destination genuinely changes
- Board and itinerary evals require a running dev server or pre-generated output files
- eval-grounding deterministic scoring is fully implemented; LLM quality check for key_facts partially implemented
