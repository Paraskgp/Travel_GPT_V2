#!/usr/bin/env npx tsx
/**
 * Itinerary Eval — Stage 3 (Two-Pass)
 *
 * Pass A: Deterministic fact extraction — no LLM, parses the JSON and
 *         extracts structured facts (activity counts, timing, experience names).
 *
 * Pass B: LLM judgment — receives the extracted facts as ground truth,
 *         not the raw itinerary. The LLM cannot hallucinate what's in
 *         the schedule because the facts are pre-extracted.
 *
 * Usage:
 *   npx tsx scripts/eval-itinerary.ts <itinerary_json> <golden_json>
 *   npx tsx scripts/eval-itinerary.ts test_outputs/..._itinerary.json golden/zion_nov2026.json
 */

import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'

try {
  const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ok */ }

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..')

// ── CLI ───────────────────────────────────────────────────────────────────────

const [, , itineraryArg, goldenArg] = process.argv
if (!itineraryArg || !goldenArg) {
  console.error('Usage: npx tsx scripts/eval-itinerary.ts <itinerary_file> <golden.json>')
  process.exit(1)
}

function resolveFile(arg: string): string {
  if (fs.existsSync(arg)) return path.resolve(arg)
  const abs = path.join(ROOT, arg)
  if (fs.existsSync(abs)) return abs
  throw new Error(`File not found: ${arg}`)
}

const itineraryFile = resolveFile(itineraryArg)
const goldenFile = resolveFile(goldenArg)

// ── Load ──────────────────────────────────────────────────────────────────────

interface ItineraryRow {
  type: 'activity' | 'travel' | 'meal'
  start_time: string
  end_time: string
  title: string
  notes: string
  planning_note: string | null
  experience_id: string | null
}
interface ItineraryDay {
  date: string; day_number: number; day_title: string; rows: ItineraryRow[]
}
interface Itinerary {
  destination: string; start_date: string; end_date: string
  days: ItineraryDay[]; change_log: string[]
}

const itineraryRaw = JSON.parse(fs.readFileSync(itineraryFile, 'utf8'))
const itinerary: Itinerary = itineraryRaw.itinerary ?? itineraryRaw
const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'))
const specs = golden.specs?.itinerary

if (!specs) {
  console.error('Golden file has no specs.itinerary block. Add it first.')
  process.exit(1)
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseTime(t: string): number {
  // Returns minutes since midnight
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// ── Pass A: Deterministic fact extraction ─────────────────────────────────────

interface ExtractedFacts {
  destination: string
  total_days: number
  total_activities: number

  // Per-day activity counts
  activities_per_day: number[]
  max_activities_per_day: number
  days_exceeding_limit: number[]  // day numbers where count > max allowed

  // Party type violations
  strenuous_activities_scheduled: string[]  // names of strenuous activities in itinerary
  activities_before_0800: string[]
  activities_ending_after_1730: string[]

  // Day discipline
  departure_day_activities: string[]  // should be empty
  arrival_day_activities: string[]

  // Shuttle / transport
  shuttle_rows: string[]
  shuttle_count: number

  // Flexibility
  flexibility_note_count: number
  flexibility_note_examples: string[]

  // Planning note quality
  planning_notes_null: number
  planning_notes_short: number  // < 30 chars — effectively empty
  planning_notes_total: number

  // Required/forbidden experience check (by name match)
  required_experiences_found: string[]
  required_experiences_missing: string[]
  forbidden_experiences_found: string[]

  // Change log
  change_log: string[]

  // Deterministic score breakdown
  checks: Array<{ check: string; passed: boolean; points: number; max_points: number; detail: string }>
  deterministic_score: number
}

function extractFacts(): ExtractedFacts {
  const required: string[] = specs.required ?? []
  const forbidden: string[] = specs.forbidden ?? []
  const maxPerDay: number = specs.max_activities_per_day ?? 3
  const noAfterTime: string = specs.no_activities_after_time ?? '99:99'
  const noBeforeTime: string = specs.no_activities_before_time ?? '00:00'
  const departureDayNumber = itinerary.days.length  // last day
  const maxDepartureDayActivities: number = specs.max_departure_day_activities ?? 0
  const shuttleRequired: boolean = specs.shuttle_required ?? false

  // Collect all activity/meal titles across all days
  const allActivities: Array<{ day: number; title: string; start: string; end: string; planning_note: string | null; effort?: string }> = []
  for (const day of itinerary.days) {
    for (const row of day.rows) {
      if (row.type === 'activity') {
        allActivities.push({
          day: day.day_number,
          title: row.title,
          start: row.start_time,
          end: row.end_time,
          planning_note: row.planning_note,
        })
      }
    }
  }

  // Per-day activity counts
  const activitiesPerDay: number[] = itinerary.days.map(day =>
    day.rows.filter(r => r.type === 'activity').length
  )
  const daysExceedingLimit = activitiesPerDay
    .map((count, i) => ({ count, dayNum: i + 1 }))
    .filter(({ count }) => count > maxPerDay)
    .map(({ dayNum }) => dayNum)

  // Strenuous check — we don't have effort in itinerary rows directly
  // We flag by name: match against known strenuous names from forbidden list + heuristics
  const strenuousKeywords = ['angels landing', "angel's landing", 'narrows', 'observation point', 'subway', 'west rim', 'cloud canyon']
  const strenuousScheduled = allActivities
    .filter(a => strenuousKeywords.some(k => a.title.toLowerCase().includes(k)))
    .map(a => `Day ${a.day}: ${a.title}`)

  // Timing checks
  const beforeCutoffMin = parseTime(noBeforeTime)
  const afterCutoffMin = parseTime(noAfterTime)
  const activitiesBefore = allActivities
    .filter(a => parseTime(a.start) < beforeCutoffMin)
    .map(a => `Day ${a.day} ${a.start}: ${a.title}`)
  const activitiesAfter = allActivities
    .filter(a => parseTime(a.end) > afterCutoffMin)
    .map(a => `Day ${a.day} ${a.end}: ${a.title}`)

  // Departure day
  const departureDay = itinerary.days.find(d => d.day_number === departureDayNumber)
  const departureDayActivities = (departureDay?.rows ?? [])
    .filter(r => r.type === 'activity')
    .map(r => r.title)

  // Arrival day
  const arrivalDay = itinerary.days.find(d => d.day_number === 1)
  const arrivalDayActivities = (arrivalDay?.rows ?? [])
    .filter(r => r.type === 'activity')
    .map(r => r.title)

  // Shuttle rows
  const shuttleRows: string[] = []
  for (const day of itinerary.days) {
    for (const row of day.rows) {
      if (row.title.toLowerCase().includes('shuttle')) {
        shuttleRows.push(`Day ${day.day_number}: ${row.title}`)
      }
    }
  }

  // Flexibility notes
  const flexibilityNotes: string[] = []
  for (const day of itinerary.days) {
    for (const row of day.rows) {
      if (row.type === 'activity' && row.planning_note) {
        const note = row.planning_note.toLowerCase()
        if (note.includes('tired') || note.includes('skip') || note.includes('flexib') || note.includes('if the group') || note.includes('rest instead')) {
          flexibilityNotes.push(`Day ${day.day_number} [${row.title}]: ${row.planning_note.slice(0, 80)}`)
        }
      }
    }
  }

  // Planning note quality
  let planningNotesNull = 0
  let planningNotesShort = 0
  let planningNotesTotal = 0
  for (const day of itinerary.days) {
    for (const row of day.rows) {
      if (row.type === 'activity' || row.type === 'meal') {
        planningNotesTotal++
        if (!row.planning_note) planningNotesNull++
        else if (row.planning_note.length < 30) planningNotesShort++
      }
    }
  }

  // Required/forbidden experience name check
  const allTitles = allActivities.map(a => normalize(a.title))
  const requiredFound: string[] = []
  const requiredMissing: string[] = []
  for (const req of required) {
    const normReq = normalize(req)
    const found = allTitles.some(t => t.includes(normReq) || normReq.includes(t))
    if (found) requiredFound.push(req)
    else requiredMissing.push(req)
  }
  const forbiddenFound: string[] = []
  for (const forb of forbidden) {
    const normForb = normalize(forb)
    const matches = allActivities.filter(a => {
      const n = normalize(a.title)
      return n.includes(normForb) || normForb.includes(n)
    })
    if (matches.length > 0) forbiddenFound.push(`${forb} (Day ${matches[0].day})`)
  }

  // ── Scoring ────────────────────────────────────────────────────────────────
  const checks: Array<{ check: string; passed: boolean; points: number; max_points: number; detail: string }> = []

  const addCheck = (check: string, passed: boolean, points: number, maxPoints: number, detail: string) => {
    checks.push({ check, passed, points: passed ? points : 0, max_points: maxPoints, detail })
  }

  // Required experiences in itinerary (25 pts)
  addCheck(
    `Required experiences scheduled (${requiredFound.length}/${required.length})`,
    requiredMissing.length === 0,
    25,
    25,
    requiredMissing.length > 0 ? `Missing: ${requiredMissing.join(', ')}` : 'All required experiences scheduled'
  )

  // Forbidden experiences not scheduled (25 pts)
  addCheck(
    `Forbidden experiences excluded (${forbidden.length} checked)`,
    forbiddenFound.length === 0,
    25,
    25,
    forbiddenFound.length > 0 ? `Forbidden scheduled: ${forbiddenFound.join(', ')}` : 'No forbidden experiences in itinerary'
  )

  // Activity density (15 pts — partial: deduct per violation)
  const densityPoints = daysExceedingLimit.length === 0 ? 15
    : Math.max(0, 15 - daysExceedingLimit.length * 5)
  checks.push({
    check: `Activity density (max ${maxPerDay}/day)`,
    passed: daysExceedingLimit.length === 0,
    points: densityPoints,
    max_points: 15,
    detail: daysExceedingLimit.length > 0
      ? `Days exceeding limit: ${daysExceedingLimit.join(', ')} (counts: ${daysExceedingLimit.map(d => activitiesPerDay[d-1]).join(', ')})`
      : `All days ≤ ${maxPerDay} activities`,
  })

  // Departure day discipline (15 pts)
  addCheck(
    `Departure day has no activities (${departureDayActivities.length} found)`,
    departureDayActivities.length <= maxDepartureDayActivities,
    15,
    15,
    departureDayActivities.length > 0 ? `Departure day activities: ${departureDayActivities.join(', ')}` : 'Departure day clean'
  )

  // Shuttle rows (10 pts — if required)
  if (shuttleRequired) {
    addCheck(
      `Shuttle transport rows present (${shuttleRows.length} rows)`,
      shuttleRows.length > 0,
      10,
      10,
      shuttleRows.length > 0 ? shuttleRows.join(', ') : 'No shuttle rows found — travelers will attempt to drive into restricted zones'
    )
  }

  // Timing violations (10 pts — partial)
  const timingPoints = (activitiesBefore.length + activitiesAfter.length) === 0 ? 10
    : Math.max(0, 10 - (activitiesBefore.length + activitiesAfter.length) * 3)
  checks.push({
    check: `Timing rules (no activities before ${noBeforeTime}, after ${noAfterTime})`,
    passed: activitiesBefore.length + activitiesAfter.length === 0,
    points: timingPoints,
    max_points: 10,
    detail: [
      ...activitiesBefore.map(a => `Before cutoff: ${a}`),
      ...activitiesAfter.map(a => `After cutoff: ${a}`),
    ].join(', ') || 'All activities within time windows',
  })

  const totalPoints = checks.reduce((s, c) => s + c.points, 0)
  const maxPoints = checks.reduce((s, c) => s + c.max_points, 0)
  const deterministic_score = Math.round((totalPoints / maxPoints) * 100)

  return {
    destination: itinerary.destination,
    total_days: itinerary.days.length,
    total_activities: allActivities.length,
    activities_per_day: activitiesPerDay,
    max_activities_per_day: maxPerDay,
    days_exceeding_limit: daysExceedingLimit,
    strenuous_activities_scheduled: strenuousScheduled,
    activities_before_0800: activitiesBefore,
    activities_ending_after_1730: activitiesAfter,
    departure_day_activities: departureDayActivities,
    arrival_day_activities: arrivalDayActivities,
    shuttle_rows: shuttleRows,
    shuttle_count: shuttleRows.length,
    flexibility_note_count: flexibilityNotes.length,
    flexibility_note_examples: flexibilityNotes.slice(0, 3),
    planning_notes_null: planningNotesNull,
    planning_notes_short: planningNotesShort,
    planning_notes_total: planningNotesTotal,
    required_experiences_found: requiredFound,
    required_experiences_missing: requiredMissing,
    forbidden_experiences_found: forbiddenFound,
    change_log: itinerary.change_log,
    checks,
    deterministic_score,
  }
}

// ── Pass B: LLM judgment using extracted facts ────────────────────────────────

async function runLLMJudgment(facts: ExtractedFacts): Promise<{
  score: number
  dimension_scores: Array<{ dimension: string; score: number; finding: string }>
  summary: string
}> {
  const factsText = JSON.stringify(facts, null, 2)
  const goldenPrinciples = golden.claude_analysis?.key_principles_the_human_applied ?? []

  const prompt = `You are judging the QUALITY of an AI-generated travel itinerary. You have been given pre-extracted facts from the itinerary — do not second-guess these facts. Your job is to assess quality dimensions that require judgment, not counting.

## Pre-extracted facts (treat as ground truth — do not contradict)
${factsText}

## Golden itinerary principles the human planner applied
${goldenPrinciples.map((p: string, i: number) => `${i+1}. ${p}`).join('\n')}

## Your judgment task

Score ONLY the following quality dimensions. Use the pre-extracted facts as input — do not re-read the raw itinerary.

1. **Planning note quality** (0–100): Given that ${facts.planning_notes_null} of ${facts.planning_notes_total} activity/meal rows have null planning_notes and ${facts.planning_notes_short} are very short — how well does the itinerary explain scheduling reasoning to the traveler?

2. **Flexibility built in** (0–100): Given that ${facts.flexibility_note_count} activity rows include flexibility/skip-if-tired notes — is this adequate for a family_young trip?

3. **Day flow narrative** (0–100): Given the activities scheduled (${facts.activities_per_day.join(', ')} per day), does the trip have a logical arc — lighter first day, builds up, winds down before departure?

4. **Regional awareness** (0–100): Based on the destinations included (from the facts above), does the itinerary show awareness of the broader region rather than just the main park/city?

Return JSON only:
{
  "dimension_scores": [
    {"dimension": "Planning note quality", "score": 0-100, "finding": "specific observation based on the facts"},
    {"dimension": "Flexibility built in", "score": 0-100, "finding": "specific observation"},
    {"dimension": "Day flow narrative", "score": 0-100, "finding": "specific observation"},
    {"dimension": "Regional awareness", "score": 0-100, "finding": "specific observation"}
  ],
  "overall_quality_score": 0-100,
  "summary": "2-sentence summary of quality assessment"
}`

  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (res.choices[0]?.message?.content ?? '{}')
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const result = JSON.parse(raw)
    return {
      score: result.overall_quality_score ?? 50,
      dimension_scores: result.dimension_scores ?? [],
      summary: result.summary ?? '',
    }
  } catch {
    return { score: 50, dimension_scores: [], summary: 'Quality judgment parse failed' }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📅 Itinerary Eval (Two-Pass)`)
  console.log(`   Itinerary   : ${path.relative(ROOT, itineraryFile)}`)
  console.log(`   Golden      : ${path.relative(ROOT, goldenFile)}`)
  console.log(`   Destination : ${itinerary.destination}`)
  console.log(`   Dates       : ${itinerary.start_date} → ${itinerary.end_date}\n`)

  // ── Pass A ─────────────────────────────────────────────────────────────────
  console.log('── Pass A: Deterministic fact extraction ─────────')
  const facts = extractFacts()

  console.log(`  Activities per day: [${facts.activities_per_day.join(', ')}]  (max allowed: ${facts.max_activities_per_day})`)

  for (const c of facts.checks) {
    const icon = c.passed ? '✅' : '❌'
    const pts = `[${c.points}/${c.max_points}]`
    console.log(`  ${icon} ${pts} ${c.check}`)
    if (!c.passed) console.log(`         → ${c.detail}`)
  }

  console.log(`\n  Deterministic score: ${facts.deterministic_score}/100`)
  console.log(`  Planning notes: ${facts.planning_notes_null} null, ${facts.planning_notes_short} short, ${facts.planning_notes_total} total`)
  console.log(`  Flexibility notes: ${facts.flexibility_note_count}`)
  console.log(`  Shuttle rows: ${facts.shuttle_count}`)

  if (facts.strenuous_activities_scheduled.length > 0) {
    console.log(`\n  🚨 Likely strenuous activities in itinerary: ${facts.strenuous_activities_scheduled.join(', ')}`)
  }
  if (facts.change_log.length > 0) {
    console.log(`\n  📝 Change log (${facts.change_log.length} entries):`)
    for (const c of facts.change_log) console.log(`    · ${c}`)
  }

  // ── Pass B ─────────────────────────────────────────────────────────────────
  console.log('\n── Pass B: LLM quality judgment ──────────────────')
  const judgment = await runLLMJudgment(facts)

  for (const dim of judgment.dimension_scores) {
    const icon = dim.score >= 70 ? '✅' : dim.score >= 50 ? '⚠️' : '❌'
    console.log(`  ${icon} ${dim.dimension}: ${dim.score}/100`)
    console.log(`     ${dim.finding}`)
  }
  console.log(`\n  > ${judgment.summary}`)

  // Combined: 65% deterministic (correctness), 35% quality
  const overallScore = Math.round(facts.deterministic_score * 0.65 + judgment.score * 0.35)

  console.log(`\n── Summary ───────────────────────────────────────`)
  console.log(`  Deterministic (correctness) : ${facts.deterministic_score}/100  [65%]`)
  console.log(`  LLM quality judgment        : ${judgment.score}/100  [35%]`)
  console.log(`  OVERALL                     : ${overallScore}/100`)

  // Save
  const output = {
    stage: 'itinerary',
    destination: itinerary.destination,
    file: path.relative(ROOT, itineraryFile),
    facts,
    judgment,
    deterministic_score: facts.deterministic_score,
    quality_score: judgment.score,
    overall_score: overallScore,
    generated_at: new Date().toISOString(),
  }

  const evalDir = path.join(ROOT, 'eval_outputs')
  fs.mkdirSync(evalDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const destSlug = itinerary.destination.toLowerCase().replace(/[\s,/]+/g, '-').replace(/-+/g, '-')
  const outFile = path.join(evalDir, `${ts}_${destSlug}_itinerary_eval.json`)
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))
  console.log(`\n  📄 Saved: ${path.relative(ROOT, outFile)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
