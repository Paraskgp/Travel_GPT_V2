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
- Generates `planning_note` on every row (scheduling rationale, not activity description)
- Fatal: must succeed or request fails

**Stage 3 — Review and refine (Pass 2):**
```
callLLM(reviewSystemPrompt(), reviewUserPrompt(draft, board, clusters, prefs), provider)
→ Itinerary (reviewed + corrected)
```
7 checks:
1. Party type violations (strenuous for family_young without accessible alternative)
2. Timing errors (activity after departure, overnight gap)
3. Activity density (correct count for pace preference)
4. Geographic conflicts (consecutive activities far apart with no travel row)
5. Departure day discipline (nothing after departure_time on final day)
6. Planning note quality (must be scheduling rationale, not activity description)
7. Forced/skipped compliance

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
| Forced IDs present in output | Forced compliance |
| Skipped IDs absent from output | Skipped compliance |
| `family_young` + strenuous experience → accessible alternative same day | Party type discipline |
| `planning_note` differs from `short_description` of the experience | Planning note quality |
| Travel rows exist between geographically distant consecutive activities | Travel row presence |

## Open technical items

- Not extracted to `lib/pipeline/` — cannot be called from audit scripts or batch tools without an HTTP server running. `prefetch.ts` hits the HTTP endpoint as a workaround.
- No constraint pre-pass before Pass 1 (P5 — score ceiling at ~62)
- Travel time estimates are LLM-generated, not from a routing API — can be significantly wrong for driving distances
- No itinerary caching — every plan request runs 3 LLM calls regardless of whether the inputs are identical to a previous request
