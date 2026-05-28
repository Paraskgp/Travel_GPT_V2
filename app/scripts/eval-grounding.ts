#!/usr/bin/env npx tsx
/**
 * Grounding Eval — Stage 1
 *
 * Checks whether the Tavily search + experience extractor produced the right
 * verified experiences for a destination.
 *
 * Usage:
 *   npx tsx scripts/eval-grounding.ts <experiences_json_or_cache_dir> <golden_json>
 *   npx tsx scripts/eval-grounding.ts cache/destinations/zion-national-park/experiences.json golden/zion_nov2026.json
 *
 * Scoring is split:
 *   - Deterministic checks (presence/absence, count, category coverage) — no LLM
 *   - Quality check (LLM samples 5 key_facts to verify they are factual, not fluffy) — 1 LLM call
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..')

// ── CLI ───────────────────────────────────────────────────────────────────────

const [, , experiencesArg, goldenArg] = process.argv

if (!experiencesArg || !goldenArg) {
  console.error('Usage: npx tsx scripts/eval-grounding.ts <experiences.json> <golden.json>')
  process.exit(1)
}

function resolveFile(arg: string): string {
  if (fs.existsSync(arg)) return path.resolve(arg)
  const abs = path.join(ROOT, arg)
  if (fs.existsSync(abs)) return abs
  throw new Error(`File not found: ${arg}`)
}

const experiencesFile = resolveFile(experiencesArg)
const goldenFile = resolveFile(goldenArg)

// ── Load ──────────────────────────────────────────────────────────────────────

interface GroundedExperience {
  name: string
  location: string
  category: string
  key_facts: string[]
  source_urls: string[]   // array — merged from all sources in reduce phase
}

interface CacheEntry<T> { data: T; generated_at: string; ttl_days: number }

const experiencesRaw = JSON.parse(fs.readFileSync(experiencesFile, 'utf8'))
const experiences: GroundedExperience[] = Array.isArray(experiencesRaw)
  ? experiencesRaw
  : (experiencesRaw as CacheEntry<GroundedExperience[]>).data

const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'))
const specs = golden.specs?.grounding

if (!specs) {
  console.error('Golden file has no specs.grounding block. Add it first.')
  process.exit(1)
}

// ── Deterministic checks ──────────────────────────────────────────────────────

interface DeterministicResult {
  required_found: string[]
  required_missing: string[]
  forbidden_found: string[]
  category_coverage: Record<string, number>
  required_categories_found: string[]
  required_categories_missing: string[]
  total_count: number
  min_count_met: boolean
  score: number
  checks: Array<{ check: string; passed: boolean; detail: string }>
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function runDeterministicChecks(): DeterministicResult {
  const names = experiences.map(e => e.name)
  const normNames = names.map(normalize)
  const checks: Array<{ check: string; passed: boolean; detail: string }> = []

  // Required experiences
  const required: string[] = specs.required ?? []
  const requiredFound: string[] = []
  const requiredMissing: string[] = []
  for (const req of required) {
    const normReq = normalize(req)
    const found = normNames.some(n => n.includes(normReq) || normReq.includes(n))
    if (found) requiredFound.push(req)
    else requiredMissing.push(req)
  }
  checks.push({
    check: `Required experiences found (${requiredFound.length}/${required.length})`,
    passed: requiredMissing.length === 0,
    detail: requiredMissing.length > 0 ? `Missing: ${requiredMissing.join(', ')}` : 'All found',
  })

  // Forbidden (hallucination check)
  const forbidden: string[] = specs.forbidden ?? []
  const forbiddenFound: string[] = []
  for (const forb of forbidden) {
    const normForb = normalize(forb)
    if (normNames.some(n => n.includes(normForb))) forbiddenFound.push(forb)
  }
  checks.push({
    check: `No hallucinated experiences (${forbidden.length} checked)`,
    passed: forbiddenFound.length === 0,
    detail: forbiddenFound.length > 0 ? `Found hallucinated: ${forbiddenFound.join(', ')}` : 'Clean',
  })

  // Category coverage
  const categoryCoverage: Record<string, number> = {}
  for (const e of experiences) {
    categoryCoverage[e.category] = (categoryCoverage[e.category] ?? 0) + 1
  }
  const requiredCats: string[] = specs.required_categories ?? []
  const catsFound = requiredCats.filter(c => categoryCoverage[c] > 0)
  const catsMissing = requiredCats.filter(c => !categoryCoverage[c])
  checks.push({
    check: `Required categories covered (${catsFound.length}/${requiredCats.length})`,
    passed: catsMissing.length === 0,
    detail: catsMissing.length > 0 ? `Missing categories: ${catsMissing.join(', ')}` : `Found: ${Object.keys(categoryCoverage).join(', ')}`,
  })

  // Minimum count
  const minCount: number = specs.min_count ?? 5
  const minMet = experiences.length >= minCount
  checks.push({
    check: `Minimum experience count (${experiences.length} >= ${minCount})`,
    passed: minMet,
    detail: minMet ? `OK — ${experiences.length} experiences` : `Only ${experiences.length}, need ${minCount}`,
  })

  // Score: each failed check deducts points
  // Required presence: 50 pts, hallucination: 25 pts, categories: 15 pts, count: 10 pts
  let score = 100
  const reqPenalty = required.length > 0 ? (requiredMissing.length / required.length) * 50 : 0
  const hallPenalty = forbiddenFound.length * 25
  const catPenalty = requiredCats.length > 0 ? (catsMissing.length / requiredCats.length) * 15 : 0
  const countPenalty = minMet ? 0 : 10
  score = Math.max(0, Math.round(score - reqPenalty - hallPenalty - catPenalty - countPenalty))

  return {
    required_found: requiredFound,
    required_missing: requiredMissing,
    forbidden_found: forbiddenFound,
    category_coverage: categoryCoverage,
    required_categories_found: catsFound,
    required_categories_missing: catsMissing,
    total_count: experiences.length,
    min_count_met: minMet,
    score,
    checks,
  }
}

// ── Deterministic quality check ───────────────────────────────────────────────
// Replaces LLM-based quality check (which had 9–84pt variance on identical data).
// Every metric is computable from the JSON without any LLM call.

interface QualityResult {
  score: number
  findings: string[]
  metrics: Record<string, number>
}

// Patterns that indicate a real, specific fact
const NUMERIC_PATTERN = /\d+(\.\d+)?\s*(miles?|km|feet|ft|hours?|hrs?|min|minutes?|\$|percent|%)/i
// Patterns that indicate vague marketing copy
const VAGUE_PATTERN = /\b(beautiful|stunning|gorgeous|amazing|popular|famous|iconic|must(-|\s)see|highly recommended|great|excellent|wonderful|breathtaking)\b/i
// "Not found in search results" marker
const MISSING_PATTERN = /not found in search results/i

function runQualityCheck(): QualityResult {
  const findings: string[] = []
  const metrics: Record<string, number> = {}

  // 1. Numeric fact rate — % of experiences with at least one fact containing a real number
  const withNumericFact = experiences.filter(e =>
    e.key_facts.some(f => NUMERIC_PATTERN.test(f) && !MISSING_PATTERN.test(f))
  )
  const numericRate = experiences.length > 0 ? withNumericFact.length / experiences.length : 0
  metrics.numeric_fact_rate = Math.round(numericRate * 100)
  findings.push(`Numeric facts: ${withNumericFact.length}/${experiences.length} experiences have at least one measurable fact (miles, feet, hours, $)`)

  // 2. Vague marketing copy rate — lower is better
  const withVague = experiences.filter(e =>
    e.key_facts.some(f => VAGUE_PATTERN.test(f) && !NUMERIC_PATTERN.test(f))
  )
  const vagueRate = experiences.length > 0 ? withVague.length / experiences.length : 0
  metrics.vague_rate = Math.round(vagueRate * 100)
  if (withVague.length > 0) {
    findings.push(`Vague copy: ${withVague.length} experiences have marketing-language facts without numbers — ${withVague.map(e => e.name).join(', ')}`)
  } else {
    findings.push(`No vague marketing copy detected`)
  }

  // 3. Average real facts per experience (excluding "not found" entries)
  const realFactCounts = experiences.map(e =>
    e.key_facts.filter(f => !MISSING_PATTERN.test(f)).length
  )
  const avgRealFacts = realFactCounts.length > 0
    ? realFactCounts.reduce((a, b) => a + b, 0) / realFactCounts.length
    : 0
  metrics.avg_real_facts = Math.round(avgRealFacts * 10) / 10
  findings.push(`Average real facts per experience: ${metrics.avg_real_facts} (${realFactCounts.join(', ')})`)

  // 4. Location specificity — does each experience have a location beyond just the destination name?
  const withSpecificLocation = experiences.filter(e =>
    e.location && e.location.split(/[,—]/).length >= 2  // at least "place, broader area"
  )
  metrics.location_specific_rate = Math.round((withSpecificLocation.length / Math.max(experiences.length, 1)) * 100)

  // Score calculation (0–100, all deterministic)
  // 40 pts: numeric fact rate (0–100% → 0–40 pts)
  // 30 pts: no vague copy (100% clean = 30 pts, deduct 3 per vague experience)
  // 20 pts: avg real facts >= 2 (full score at 3+)
  // 10 pts: location specificity
  const numericScore = Math.round(numericRate * 40)
  const vagueScore = Math.max(0, 30 - withVague.length * 3)
  const factCountScore = Math.min(20, Math.round((avgRealFacts / 3) * 20))
  const locationScore = Math.round((withSpecificLocation.length / Math.max(experiences.length, 1)) * 10)
  const score = numericScore + vagueScore + factCountScore + locationScore

  metrics.numeric_score = numericScore
  metrics.vague_score = vagueScore
  metrics.fact_count_score = factCountScore
  metrics.location_score = locationScore

  return { score, findings, metrics }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🔍 Grounding Eval`)
  console.log(`   Experiences : ${path.relative(ROOT, experiencesFile)} (${experiences.length} items)`)
  console.log(`   Golden      : ${path.relative(ROOT, goldenFile)}`)
  console.log(`   Destination : ${golden.meta?.destination ?? 'unknown'}\n`)

  const det = runDeterministicChecks()
  console.log('── Deterministic checks ──────────────────────────')
  for (const c of det.checks) {
    const icon = c.passed ? '✅' : '❌'
    console.log(`  ${icon} ${c.check}`)
    if (!c.passed) console.log(`     → ${c.detail}`)
  }
  console.log(`  Deterministic score: ${det.score}/100\n`)

  console.log('── Quality checks (deterministic) ────────────────')
  const quality = runQualityCheck()
  console.log(`  Quality score: ${quality.score}/100`)
  console.log(`  Breakdown: numeric=${quality.metrics.numeric_score} vague=${quality.metrics.vague_score} facts=${quality.metrics.fact_count_score} location=${quality.metrics.location_score}`)
  for (const f of quality.findings) if (f) console.log(`  · ${f}`)

  // Combined score: 70% deterministic (correctness), 30% quality (fact specificity)
  const overallScore = Math.round(det.score * 0.7 + quality.score * 0.3)

  console.log(`\n── Summary ───────────────────────────────────────`)
  console.log(`  Deterministic : ${det.score}/100`)
  console.log(`  Quality       : ${quality.score}/100`)
  console.log(`  OVERALL       : ${overallScore}/100`)

  if (det.required_missing.length > 0) {
    console.log(`\n  🚨 Missing required: ${det.required_missing.join(', ')}`)
    console.log(`     Fix: check Tavily queries — add a more targeted query for these experiences`)
  }
  if (det.forbidden_found.length > 0) {
    console.log(`\n  🚨 Hallucinated names found: ${det.forbidden_found.join(', ')}`)
    console.log(`     Fix: tighten experience-extractor.md — raise bar for "only verify from snippets"`)
  }

  // Save output
  const output = {
    stage: 'grounding',
    destination: golden.meta?.destination,
    file: path.relative(ROOT, experiencesFile),
    total_experiences: experiences.length,
    ...det,
    quality_score: quality.score,
    quality_metrics: quality.metrics,
    quality_findings: quality.findings,
    overall_score: overallScore,
    generated_at: new Date().toISOString(),
  }

  const evalDir = path.join(ROOT, 'eval_outputs')
  fs.mkdirSync(evalDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outFile = path.join(evalDir, `${ts}_grounding_eval.json`)
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))
  console.log(`\n  📄 Saved: ${path.relative(ROOT, outFile)}`)
}

main()
