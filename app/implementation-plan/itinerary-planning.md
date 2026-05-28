# Implementation Plan: Itinerary Planning

## Owns

`app/api/plan/route.ts` — inline pipeline (not yet extracted to `lib/pipeline/`)

**Note:** This is the one board-adjacent pipeline that has NOT been extracted into `lib/pipeline/` yet. It is self-contained in `plan/route.ts`. Extraction is deferred — the route is ~110 lines and only called from one place. When a second caller exists (e.g. an audit script or a batch planner), extract it.

## Inputs / Outputs

```typescript
// POST /api/plan
body: {
  board: Board
  start_date: string          // ISO date
  end_date: string            // ISO date
  arrival_time?: string       // "09:00"
  departure_time?: string     // "14:00"
  stay_area?: string          // geographic anchor
  preferences?: Preferences   // party_type applied here
  forced_ids?: string[]
  skipped_ids?: string[]
  provider?: Provider
}

response: { itinerary: Itinerary, clusters?: ClusterResult }
```

## Steps

**Stage 1 — Geographic clustering:**
```
callLLM(clusterSystemPrompt(), clusterUserPrompt(board), provider)
→ ClusterResult: { pairs: TravelPair[], clusters: ExperienceCluster[] }
```
- Estimates pairwise travel times between all experience locations
- Groups experiences within ~15 min walking distance into named clusters
- Non-fatal: if clustering fails, Pass 1 runs without cluster context

**Stage 2 — Draft itinerary (Pass 1):**
```
callLLM(itinerarySystemPrompt(), itineraryUserPrompt(board, start_date, end_date, ..., clusters), provider)
→ Itinerary (draft)
```
- Picks 1–2 geographic clusters per day
- Schedules around `best_time` anchors
- Injects `board.weather_context` as a `## Seasonal Conditions` block:
  - Sunrise/sunset times (hard constraint: no activity ends after sunset)
  - Travel implications from weather context (shuttle status, facility closures, seasonal warnings)
  - Cold-water month detection: if month is Nov–Apr, flag wading hike gear requirement
- Applies couple behavioral rules from system prompt (sunset activity, no back-to-back strenuous, romantic dining priority)
- Flags permit-required activities in `planning_note` (detected from `local_tip` text containing "permit", "lottery", "advance")
- Generates `planning_note` on every row (scheduling rationale, not activity description)
- Fatal: must succeed or request fails

**Stage 3 — Review and refine (Pass 2):**
```
callLLM(reviewSystemPrompt(), reviewUserPrompt(draft, board, clusters, prefs), provider)
→ Itinerary (reviewed + corrected)
```
Also injects `board.weather_context` as the same `## Seasonal Conditions` block so the reviewer has sunset times.

10 checks:
1. Party type violations (strenuous for family_young without accessible alternative; back-to-back strenuous for couple)
2. Timing errors (activity after departure, overnight gap)
3. Activity density (correct count for pace preference)
4. Geographic conflicts — HARD rule: if total driving >2 hrs on a day, move activity. No "consider" language.
5. Departure day discipline (nothing after departure_time on final day)
6. Arrival day discipline (nothing after check-in if arriving after 15:00)
7. Planning note quality (must be scheduling rationale — rewrite if generic)
8. **Sunset violations (NEW):** Any activity ending after sunset time → MOVE or REMOVE
9. **Permit violations (NEW):** Any permit-required activity without permit planning_note → ADD warning
10. **Cold water violations (NEW):** Any wading hike in cold-water month without gear warning → ADD warning

Non-fatal: if Pass 2 fails, Pass 1 draft returned with note in `change_log[]`.

## Caching

None. Itineraries are not cached — they depend on user-specific preferences, dates, and forced/skipped IDs that make caching impractical.

## Failure handling

- Clustering failure: non-fatal, logged, planning continues without clusters
- Pass 1 failure: fatal, returns HTTP 500
- Pass 2 failure: non-fatal, returns Pass 1 draft

## Unit tests

| Test | Covers success criterion |
|---|---|
| Activity count per day matches pace (relaxed=2–3, moderate=3–4) | Pace compliance |
| No activity scheduled after `departure_time` on final day | Departure day discipline |
| No activity ends after sunset time when weather context has sunset | Sunset constraint |
| Forced IDs present in output | Forced compliance |
| Skipped IDs absent from output | Skipped compliance |
| `family_young` + strenuous experience → removed by Pass 2 | Party type discipline |
| `couple` + two consecutive strenuous days → Pass 2 inserts moderate day between them | Couple no-back-to-back strenuous |
| `couple` → at least one sunset-timed activity in itinerary | Couple sunset activity |
| Permit-required experience → `planning_note` contains booking action | Permit awareness |
| Wading hike in November → `planning_note` contains drysuit/gear warning | Cold water awareness |
| `planning_note` differs from `short_description` of the experience | Planning note quality |
| Travel rows exist between geographically distant consecutive activities | Travel row presence |

## Open technical items

- Not extracted to `lib/pipeline/` — cannot be called from audit scripts or batch tools without an HTTP server running. `prefetch.ts` hits the HTTP endpoint as a workaround.
- No constraint pre-pass before Pass 1 (P5 — score ceiling at ~62)
- Travel time estimates are LLM-generated, not from a routing API — can be significantly wrong for driving distances
- No itinerary caching — every plan request runs 3 LLM calls regardless of whether the inputs are identical to a previous request
- Cold-water detection uses month-name heuristic (Nov–Apr) — not a structured `water_temp_f` field. Destinations where cold water occurs in different months (e.g. glacial rivers in July) will not be flagged. (2026-05-28)
- Permit detection is text-based (reads `local_tip`) — if a permit requirement is not mentioned in the tip, the check silently passes. (2026-05-28)
- Weather context `travel_implications` injected verbatim — no filtering for shuttle-specific implications. If a destination's implications don't mention shuttle status, the shuttle language in the prompt remains uncorrected. (2026-05-28)
