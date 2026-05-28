#!/usr/bin/env npx tsx
/**
 * Board Eval — Stage 2
 *
 * Checks whether the board generation produced the right experiences with
 * correct properties, tier coverage, and specific local tips.
 *
 * Usage:
 *   npx tsx scripts/eval-board.ts <board_json_file> <golden_json>
 *   npx tsx scripts/eval-board.ts test_outputs/2026-05-27_zion-national-park.json golden/zion_nov2026.json
 *
 * Scoring:
 *   - Deterministic (70%): required/forbidden experience presence, tier coverage, deduplication
 *   - LLM quality (30%): samples 5 local_tips for specificity
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

const [, , boardArg, goldenArg] = process.argv
if (!boardArg || !goldenArg) {
  console.error('Usage: npx tsx scripts/eval-board.ts <board_file> <golden.json>')
  process.exit(1)
}

function resolveFile(arg: string): string {
  if (fs.existsSync(arg)) return path.resolve(arg)
  const abs = path.join(ROOT, arg)
  if (fs.existsSync(abs)) return abs
  throw new Error(`File not found: ${arg}`)
}

const boardFile = resolveFile(boardArg)
const goldenFile = resolveFile(goldenArg)

// ── Load ──────────────────────────────────────────────────────────────────────

interface Experience {
  id: string; name: string; effort: string; local_tip: string
  location_hint: string; is_mappable: boolean; suitability_tags?: string[]
}
interface Theme { id: string; name: string; experiences: Experience[] }
interface Board { destination: string; themes: Theme[] }

const boardRaw = JSON.parse(fs.readFileSync(boardFile, 'utf8'))
const board: Board = boardRaw.board ?? boardRaw
const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'))
const specs = golden.specs?.board

if (!specs) {
  console.error('Golden file has no specs.board block. Add it first.')
  process.exit(1)
}

// Flatten all experiences
const allExperiences: Array<Experience & { theme_id: string; theme_name: string }> = []
for (const theme of board.themes) {
  for (const exp of theme.experiences) {
    allExperiences.push({ ...exp, theme_id: theme.id ?? theme.name, theme_name: theme.name })
  }
}

// ── Deterministic checks ──────────────────────────────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface BoardDeterministicResult {
  required_found: string[]
  required_missing: string[]
  forbidden_found: string[]
  tier_coverage: Record<string, Record<string, number>>  // theme → effort → count
  tier_missing: string[]  // "hiking needs strenuous"
  duplicate_names: string[]
  unmappable_count: number
  total_experiences: number
  theme_count: number
  checks: Array<{ check: string; passed: boolean; detail: string }>
  score: number
}

function runDeterministicChecks(): BoardDeterministicResult {
  const normNames = allExperiences.map(e => ({ norm: normalize(e.name), raw: e.name, effort: e.effort, theme: e.theme_id }))
  const checks: Array<{ check: string; passed: boolean; detail: string }> = []

  // Required experiences
  const required: string[] = specs.required ?? []
  const requiredFound: string[] = []
  const requiredMissing: string[] = []
  for (const req of required) {
    const normReq = normalize(req)
    const found = normNames.some(n => n.norm.includes(normReq) || normReq.includes(n.norm))
    if (found) requiredFound.push(req)
    else requiredMissing.push(req)
  }
  checks.push({
    check: `Required experiences on board (${requiredFound.length}/${required.length})`,
    passed: requiredMissing.length === 0,
    detail: requiredMissing.length > 0 ? `Missing: ${requiredMissing.join(', ')}` : 'All found',
  })

  // Forbidden experiences
  const forbidden: string[] = specs.forbidden ?? []
  const forbiddenFound: string[] = []
  for (const forb of forbidden) {
    const normForb = normalize(forb)
    const found = normNames.filter(n => n.norm.includes(normForb)).map(n => n.raw)
    forbiddenFound.push(...found)
  }
  checks.push({
    check: `No hallucinated/forbidden experiences`,
    passed: forbiddenFound.length === 0,
    detail: forbiddenFound.length > 0 ? `Found: ${forbiddenFound.join(', ')}` : 'Clean',
  })

  // Tier coverage (effort levels per theme)
  const tierCoverage: Record<string, Record<string, number>> = {}
  for (const theme of board.themes) {
    tierCoverage[theme.id ?? theme.name] = {}
    for (const exp of theme.experiences) {
      const t = tierCoverage[theme.id ?? theme.name]
      t[exp.effort] = (t[exp.effort] ?? 0) + 1
    }
  }
  const requiredTiers: Record<string, string[]> = specs.required_effort_levels ?? {}
  const tierMissing: string[] = []
  for (const [themeId, levels] of Object.entries(requiredTiers)) {
    const coverage = tierCoverage[themeId] ?? {}
    for (const level of levels) {
      if (!coverage[level] || coverage[level] === 0) {
        tierMissing.push(`${themeId} needs ${level}`)
      }
    }
  }
  checks.push({
    check: `Tier coverage (effort levels per theme)`,
    passed: tierMissing.length === 0,
    detail: tierMissing.length > 0 ? tierMissing.join(', ') : 'All tiers covered',
  })

  // Deduplication check
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const e of allExperiences) {
    const n = normalize(e.name)
    if (seen.has(n)) duplicates.push(e.name)
    seen.add(n)
  }
  checks.push({
    check: `No duplicate experience names`,
    passed: duplicates.length === 0,
    detail: duplicates.length > 0 ? `Duplicates: ${duplicates.join(', ')}` : 'No duplicates',
  })

  // Mappability
  const unmappable = allExperiences.filter(e => !e.is_mappable)
  checks.push({
    check: `Experiences are mappable (${allExperiences.length - unmappable.length}/${allExperiences.length})`,
    passed: unmappable.length === 0,
    detail: unmappable.length > 0 ? `Not mappable: ${unmappable.map(e => e.name).join(', ')}` : 'All mappable',
  })

  // Score: weighted by importance
  let score = 100
  const reqPenalty = required.length > 0 ? (requiredMissing.length / required.length) * 40 : 0
  const hallPenalty = forbiddenFound.length * 20
  const tierPenalty = Object.values(requiredTiers).flat().length > 0
    ? (tierMissing.length / Object.values(requiredTiers).flat().length) * 25
    : 0
  const dupPenalty = duplicates.length * 5
  const mapPenalty = allExperiences.length > 0 ? (unmappable.length / allExperiences.length) * 10 : 0
  score = Math.max(0, Math.round(score - reqPenalty - hallPenalty - tierPenalty - dupPenalty - mapPenalty))

  return {
    required_found: requiredFound,
    required_missing: requiredMissing,
    forbidden_found: forbiddenFound,
    tier_coverage: tierCoverage,
    tier_missing: tierMissing,
    duplicate_names: duplicates,
    unmappable_count: unmappable.length,
    total_experiences: allExperiences.length,
    theme_count: board.themes.length,
    checks,
    score,
  }
}

// ── LLM quality check (tip specificity) ──────────────────────────────────────

async function runTipQualityCheck(): Promise<{ score: number; findings: string[] }> {
  // Sample 5 experiences with tips
  const sample = allExperiences
    .filter(e => e.local_tip && e.local_tip.length > 10)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)

  if (sample.length === 0) return { score: 0, findings: ['No local tips found'] }

  const sampleText = sample.map(e =>
    `Experience: ${e.name} (${e.theme_name})\nLocation: ${e.location_hint}\nTip: "${e.local_tip}"`
  ).join('\n\n---\n\n')

  const prompt = `You are auditing local_tip quality for a travel board. Each tip is supposed to be:
- Impossible to detach from this exact named place (specific location, feature, timing)
- Not a generic travel cliché ("arrive early", "book in advance", "wear comfortable shoes")
- One concrete insight that most visitors would miss

Rate each tip 1–10 and explain briefly. Then score overall quality 0–100.

BANNED tips (auto-score 1): "arrive early", "book in advance", "wear comfortable shoes", "can get crowded", "perfect for families", "bring water", "check the weather", "visit in the morning"

Tips to audit:
${sampleText}

Return JSON only:
{
  "ratings": [{"name": "...", "score": 1-10, "reason": "..."}],
  "overall_score": 0-100,
  "verdict": "one sentence overall verdict"
}`

  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (res.choices[0]?.message?.content ?? '{}')
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const result = JSON.parse(raw)
    return {
      score: result.overall_score ?? 50,
      findings: [result.verdict ?? '', ...(result.ratings ?? []).map((r: any) => `  ${r.name} (${r.score}/10): ${r.reason}`)],
    }
  } catch {
    return { score: 50, findings: ['Tip quality check parse failed'] }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🗂  Board Eval`)
  console.log(`   Board       : ${path.relative(ROOT, boardFile)}`)
  console.log(`   Golden      : ${path.relative(ROOT, goldenFile)}`)
  console.log(`   Destination : ${board.destination}`)
  console.log(`   Themes      : ${board.themes.length}, Experiences: ${allExperiences.length}\n`)

  const det = runDeterministicChecks()
  console.log('── Deterministic checks ──────────────────────────')
  for (const c of det.checks) {
    const icon = c.passed ? '✅' : '❌'
    console.log(`  ${icon} ${c.check}`)
    if (!c.passed) console.log(`     → ${c.detail}`)
  }
  console.log(`  Deterministic score: ${det.score}/100\n`)

  console.log('── Effort tier coverage ──────────────────────────')
  for (const [theme, levels] of Object.entries(det.tier_coverage)) {
    const parts = Object.entries(levels).map(([e, n]) => `${e}×${n}`).join(', ')
    console.log(`  ${theme}: ${parts}`)
  }
  console.log()

  console.log('── Tip quality check (LLM) ───────────────────────')
  const quality = await runTipQualityCheck()
  console.log(`  Quality score: ${quality.score}/100`)
  for (const f of quality.findings) if (f) console.log(`  · ${f}`)

  const overallScore = Math.round(det.score * 0.7 + quality.score * 0.3)

  console.log(`\n── Summary ───────────────────────────────────────`)
  console.log(`  Deterministic : ${det.score}/100`)
  console.log(`  Tip quality   : ${quality.score}/100`)
  console.log(`  OVERALL       : ${overallScore}/100`)

  if (det.required_missing.length > 0) {
    console.log(`\n  🚨 Missing from board: ${det.required_missing.join(', ')}`)
    console.log(`     Fix: check Tavily grounding — these should be in experiences.json and injected into theme prompts`)
  }
  if (det.tier_missing.length > 0) {
    console.log(`\n  ⚠️  Tier gaps: ${det.tier_missing.join(', ')}`)
    console.log(`     Fix: check theme prompt tier requirements are being honored`)
  }

  const output = {
    stage: 'board',
    destination: board.destination,
    file: path.relative(ROOT, boardFile),
    ...det,
    tip_quality_score: quality.score,
    tip_quality_findings: quality.findings,
    overall_score: overallScore,
    generated_at: new Date().toISOString(),
  }

  const evalDir = path.join(ROOT, 'eval_outputs')
  fs.mkdirSync(evalDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const destSlug = board.destination.toLowerCase().replace(/[\s,/]+/g, '-').replace(/-+/g, '-')
  const outFile = path.join(evalDir, `${ts}_${destSlug}_board_eval.json`)
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))
  console.log(`\n  📄 Saved: ${path.relative(ROOT, outFile)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
