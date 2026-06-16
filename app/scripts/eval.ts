#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Itinerary Evaluator
 *
 * Usage:
 *   npx tsx scripts/eval.ts <itinerary_file> [golden_file]
 *   npx tsx scripts/eval.ts test_outputs/2026-05-27_yellowstone_itinerary.json
 *   npx tsx scripts/eval.ts test_outputs/2026-05-27_yellowstone_itinerary.json golden/yellowstone_may2026.json
 *
 * Auto-discovers golden file by destination name if not specified.
 */

import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'

// Load .env.local manually for script context
import { readFileSync } from 'fs'
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* file may not exist */ }

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

// ── CLI args ──────────────────────────────────────────────────────────────────

const [, , itineraryArg, goldenArg] = process.argv

if (!itineraryArg) {
  console.error('Usage: npx tsx scripts/eval.ts <itinerary_file> [golden_file]')
  process.exit(1)
}

const ROOT = path.resolve(__dirname, '..')

function resolveFile(arg: string, dir: string): string {
  if (fs.existsSync(arg)) return path.resolve(arg)
  const abs = path.join(ROOT, arg)
  if (fs.existsSync(abs)) return abs
  // Try finding latest match in dir by slug
  const slug = arg.toLowerCase().replace(/[\s,/]+/g, '-').replace(/-+/g, '-')
  const files = fs.readdirSync(dir)
    .filter(f => f.includes(slug) && f.endsWith('.json'))
    .sort()
    .reverse()
  if (files.length > 0) return path.join(dir, files[0])
  throw new Error(`File not found: ${arg}`)
}

function findGolden(itineraryFile: string): string | null {
  const goldenDir = path.join(ROOT, 'golden')
  if (!fs.existsSync(goldenDir)) return null
  // Try to match by destination name embedded in the itinerary
  const itinerary = JSON.parse(fs.readFileSync(itineraryFile, 'utf8'))
  const dest: string = (itinerary.itinerary?.destination ?? '').toLowerCase()
  const files = fs.readdirSync(goldenDir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const name = f.replace('.json', '').replace(/_/g, ' ')
    if (dest.includes(name.split('_')[0]) || name.includes(dest.split(' ')[0])) {
      return path.join(goldenDir, f)
    }
  }
  // Fall back to first golden file
  if (files.length > 0) return path.join(goldenDir, files[0])
  return null
}

const itineraryFile = resolveFile(itineraryArg, path.join(ROOT, 'test_outputs'))
const goldenFile = goldenArg ? resolveFile(goldenArg, path.join(ROOT, 'golden')) : findGolden(itineraryFile)

console.log(`\n📋 Itinerary : ${path.relative(ROOT, itineraryFile)}`)
console.log(`🏆 Golden    : ${goldenFile ? path.relative(ROOT, goldenFile) : 'none — running without golden reference'}`)
console.log('')

// ── Load files ─────────────────────────────────────────────────────────────────

const itineraryData = JSON.parse(fs.readFileSync(itineraryFile, 'utf8'))
const itinerary = itineraryData.itinerary ?? itineraryData

const golden = goldenFile ? JSON.parse(fs.readFileSync(goldenFile, 'utf8')) : null

// ── Coverage check (board → golden locations) ─────────────────────────────────

let boardFile: string | null = null
// Try to find the board file that corresponds to this itinerary
const itBase = path.basename(itineraryFile).replace('_itinerary.json', '.json')
const potentialBoard = path.join(ROOT, 'test_outputs', itBase)
if (fs.existsSync(potentialBoard)) boardFile = potentialBoard

let board: any = null
if (boardFile) {
  const boardData = JSON.parse(fs.readFileSync(boardFile, 'utf8'))
  board = boardData.board ?? boardData
}

// ── Build eval prompt ─────────────────────────────────────────────────────────

const SYSTEM = `You are a ruthless travel itinerary evaluator. Your job is to score an AI-generated itinerary against a human-planned golden reference and produce actionable feedback that will be used to improve the AI's prompts.

Be specific and brutally honest. Don't soften findings. Name the exact activities, times, and days where the AI failed. Vague feedback ("pacing could be better") is useless — precise feedback ("Day 1 schedules wildlife viewing at 10:30 AM instead of before 8 AM, violating the dawn-wildlife rule") is useful.

Return ONLY valid JSON. No markdown, no commentary outside the JSON.`

function buildCoverageSection(): string {
  if (!golden || !board) return ''
  const mustHave: string[] = golden.locations_visited
    ?.filter((l: any) => l.role === 'headline')
    .map((l: any) => l.name) ?? []
  const allThemeExps = board.themes?.flatMap((t: any) =>
    t.experiences.map((e: any) => e.name)
  ) ?? []
  return `
## Board Coverage Check
Must-have locations from golden: ${JSON.stringify(mustHave)}
Experiences on the board: ${JSON.stringify(allThemeExps)}
`
}

function buildItinerarySummary(): string {
  const days = itinerary.days ?? []
  return days.map((d: any) => {
    const rows = d.rows.map((r: any) =>
      `    [${r.type.toUpperCase()}] ${r.start_time}-${r.end_time} ${r.title} | ${r.notes ?? ''}`
    ).join('\n')
    return `Day ${d.day_number} (${d.date}) — "${d.day_title}"\n${rows}`
  }).join('\n\n')
}

function buildGoldenSummary(): string {
  if (!golden) return 'No golden reference provided.'
  const days = golden.days ?? []
  return days.map((d: any) => {
    const rows = d.rows.map((r: any) =>
      `    ${r.time} — ${r.activity}${r.drive_time ? ` [drive: ${r.drive_time}]` : ''} | ${r.notes ?? ''}`
    ).join('\n')
    return `Day ${d.day_number} (${d.date}) — "${d.title}"\n${rows}\n  Principles: ${(d.day_principles ?? []).join('; ')}`
  }).join('\n\n')
}

const userPrompt = `
# Evaluation Task

You are comparing an AI-generated Yellowstone itinerary against a human expert's itinerary.

---
## AI-Generated Itinerary
Destination: ${itinerary.destination}
Dates: ${itinerary.start_date} → ${itinerary.end_date}

${buildItinerarySummary()}

---
## Human Golden Reference
${buildGoldenSummary()}

---
## Key Principles from Human Planner
${golden ? JSON.stringify(golden.claude_analysis?.key_principles_the_human_applied ?? [], null, 2) : 'Not available'}

---
${buildCoverageSection()}

---
## Scoring Rubric
${golden ? JSON.stringify(golden.claude_analysis?.rubric_for_eval_agent ?? {}, null, 2) : 'Use general best practices for travel itinerary quality.'}

---

## Your Task

Score the AI itinerary on each dimension in the rubric. Then produce:
1. A per-day breakdown — what the AI got right and wrong on each day
2. Specific prompt improvement suggestions — concrete changes to the AI's system prompt that would fix each failure

Return this exact JSON structure:

{
  "overall_score": number,           // 0-100
  "overall_grade": string,           // "A", "B+", etc.
  "summary": string,                 // 2-3 sentence executive summary

  "coverage": {
    "must_have_found": string[],     // locations from golden that ARE on the board
    "must_have_missing": string[],   // locations from golden that are NOT on the board
    "coverage_score": number         // 0-100
  },

  "dimension_scores": [
    {
      "dimension": string,
      "weight": number,
      "score": number,               // 0-100
      "weighted_score": number,
      "pass": boolean,
      "finding": string,             // specific, detailed observation
      "example": string              // exact quote from AI itinerary that illustrates the finding
    }
  ],

  "day_analysis": [
    {
      "day_number": number,
      "date": string,
      "ai_title": string,
      "golden_title": string,
      "score": number,               // 0-100
      "hits": string[],              // things the AI got right
      "misses": string[],            // things the AI got wrong
      "worst_mistake": string        // single most egregious error on this day
    }
  ],

  "top_failures": [
    {
      "failure": string,             // concise name
      "severity": "critical" | "major" | "minor",
      "description": string,
      "prompt_fix": string           // exact wording to add/change in the AI prompt
    }
  ],

  "what_ai_got_right": string[],    // genuine strengths

  "prompt_improvement_plan": {
    "itinerary_prompt_changes": string[],  // changes to prompts/itinerary.md
    "board_generation_changes": string[]   // changes to board/destination context prompts
  }
}
`

// ── Run eval ───────────────────────────────────────────────────────────────────

console.log('🤔 Running evaluation (Claude as judge)...\n')

async function runEval() {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let result: any
  try {
    result = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse eval JSON. Raw output:')
    console.log(raw)
    process.exit(1)
  }

  // ── Save output ───────────────────────────────────────────────────────────────

  const evalDir = path.join(ROOT, 'eval_outputs')
  fs.mkdirSync(evalDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const destSlug = (itinerary.destination ?? 'unknown').toLowerCase().replace(/[\s,/]+/g, '-').replace(/-+/g, '-')
  const evalJsonFile = path.join(evalDir, `${ts}_${destSlug}_eval.json`)
  const evalMdFile = path.join(evalDir, `${ts}_${destSlug}_eval.md`)

  fs.writeFileSync(evalJsonFile, JSON.stringify(result, null, 2))

  // ── Render markdown report ─────────────────────────────────────────────────

  const md = renderMarkdown(result, itinerary)
  fs.writeFileSync(evalMdFile, md)

  // ── Print to console ───────────────────────────────────────────────────────

  console.log(md)
  console.log('\n──────────────────────────────────────────')
  console.log(`📄 JSON  : ${path.relative(ROOT, evalJsonFile)}`)
  console.log(`📝 Report: ${path.relative(ROOT, evalMdFile)}`)
}

function renderMarkdown(r: any, itin: any): string {
  const lines: string[] = []

  lines.push(`# Itinerary Eval — ${itin.destination}`)
  lines.push(`**Dates:** ${itin.start_date} → ${itin.end_date}  |  **Grade: ${r.overall_grade}  (${r.overall_score}/100)**\n`)
  lines.push(`> ${r.summary}\n`)

  // Coverage
  if (r.coverage) {
    lines.push(`## Board Coverage  (${r.coverage.coverage_score}/100)`)
    lines.push(`✅ Found: ${r.coverage.must_have_found?.join(', ') || 'none'}`)
    lines.push(`❌ Missing: ${r.coverage.must_have_missing?.join(', ') || 'none'}\n`)
  }

  // Dimension scores
  lines.push('## Dimension Scores')
  lines.push('| Dimension | Weight | Score | Pass? | Finding |')
  lines.push('|---|---|---|---|---|')
  for (const d of r.dimension_scores ?? []) {
    const pass = d.pass ? '✅' : '❌'
    lines.push(`| ${d.dimension} | ${(d.weight * 100).toFixed(0)}% | ${d.score}/100 | ${pass} | ${d.finding} |`)
  }
  lines.push('')

  // Day analysis
  lines.push('## Day-by-Day Analysis')
  for (const day of r.day_analysis ?? []) {
    lines.push(`### Day ${day.day_number} — ${day.ai_title}  (${day.score}/100)`)
    if (day.golden_title) lines.push(`*Golden: "${day.golden_title}"*`)
    if (day.hits?.length) lines.push(`**✅ Hits:** ${day.hits.join(' · ')}`)
    if (day.misses?.length) lines.push(`**❌ Misses:** ${day.misses.join(' · ')}`)
    if (day.worst_mistake) lines.push(`**🚨 Worst mistake:** ${day.worst_mistake}`)
    lines.push('')
  }

  // Top failures
  lines.push('## Top Failures')
  for (const f of r.top_failures ?? []) {
    const icon = f.severity === 'critical' ? '🚨' : f.severity === 'major' ? '⚠️' : '💡'
    lines.push(`### ${icon} ${f.failure}  \`${f.severity}\``)
    lines.push(f.description)
    lines.push(`\n**Prompt fix:** *${f.prompt_fix}*\n`)
  }

  // What AI got right
  if (r.what_ai_got_right?.length) {
    lines.push('## What the AI Got Right')
    for (const w of r.what_ai_got_right) lines.push(`- ${w}`)
    lines.push('')
  }

  // Prompt improvement plan
  if (r.prompt_improvement_plan) {
    lines.push('## Prompt Improvement Plan')
    lines.push('### Changes to `prompts/itinerary.md`')
    for (const c of r.prompt_improvement_plan.itinerary_prompt_changes ?? []) lines.push(`- ${c}`)
    lines.push('\n### Changes to board/destination prompts')
    for (const c of r.prompt_improvement_plan.board_generation_changes ?? []) lines.push(`- ${c}`)
  }

  return lines.join('\n')
}

runEval().catch(err => {
  console.error('Eval failed:', err)
  process.exit(1)
})
