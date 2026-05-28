#!/usr/bin/env npx tsx
/**
 * Step-by-step pipeline auditor.
 *
 * Each step calls the same production function the generate route uses.
 * Cache behaviour is identical to production — steps that hit cache say so.
 *
 * Usage:
 *   npx tsx scripts/step-audit.ts 1 "Zion National Park"
 *   npx tsx scripts/step-audit.ts 2 "Zion National Park" "November 2026"
 *   npx tsx scripts/step-audit.ts 3 "Zion National Park"
 *   npx tsx scripts/step-audit.ts 4                         # reads .audit-queries.json
 *   npx tsx scripts/step-audit.ts 5                         # reads .audit-search-results.json
 *   npx tsx scripts/step-audit.ts 6 "Zion National Park"   # reads .audit-search-results.json + .audit-scraped.json
 */

import fs from "fs"
import path from "path"

const ROOT = path.resolve(import.meta.dirname, "..")

// Load .env.local
const envFile = path.join(ROOT, ".env.local")
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

// Audit file paths — intermediate results saved for cross-step inspection
const QUERIES_FILE        = path.join(ROOT, ".audit-queries.json")
const SEARCH_FILE         = path.join(ROOT, ".audit-search-results.json")
const SCRAPED_FILE        = path.join(ROOT, ".audit-scraped.json")
const EXPERIENCES_FILE    = path.join(ROOT, ".audit-experiences.json")

async function main() {
  const { getDestinationContext }  = await import("../lib/pipeline/destination-context.js")
  const { getWeatherContext }      = await import("../lib/pipeline/weather-context.js")
  const { generateQueries, annotateResults, extractExperiences } = await import("../lib/pipeline/experiences.js")
  const { tavilyBatchSearch }      = await import("../lib/tavily/client.js")
  const { scrapeUrls }             = await import("../lib/scraper/client.js")

  const [,, stepArg, destArg, monthArg] = process.argv
  const step  = parseInt(stepArg ?? "1")
  const dest  = destArg ?? "Zion National Park"
  const month = monthArg ?? "November 2026"
  const monthSlug = month.toLowerCase().split(" ")[0]

  // ── Step 1: Destination context ──────────────────────────────────────────────
  if (step === 1) {
    console.log(`\n── Step 1: Destination Context ──────────────────────────────`)
    console.log(`Destination : ${dest}\n`)

    const ctx = await getDestinationContext(dest)
    console.log(JSON.stringify(ctx, null, 2))
    console.log(`\n📄 Cached at: cache/destinations/${slug(dest)}/destination_context.json`)
  }

  // ── Step 2: Weather context ──────────────────────────────────────────────────
  if (step === 2) {
    console.log(`\n── Step 2: Weather Context ──────────────────────────────────`)
    console.log(`Destination : ${dest}`)
    console.log(`Month       : ${month}\n`)

    const ctx = await getWeatherContext(dest, month, monthSlug)
    console.log(JSON.stringify(ctx, null, 2))
    console.log(`\n📄 Cached at: cache/destinations/${slug(dest)}/weather_${monthSlug}.json`)
  }

  // ── Step 3: Query generation ─────────────────────────────────────────────────
  if (step === 3) {
    console.log(`\n── Step 3: Query Generation ─────────────────────────────────`)
    console.log(`Destination : ${dest}\n`)

    // getDestinationContext hits cache if warm — no redundant LLM call
    const destCtx = await getDestinationContext(dest)
    const queries = await generateQueries(dest, destCtx.applicable_themes)

    queries.forEach((q, i) => console.log(`  ${String(i + 1).padStart(2)}. ${q}`))
    fs.writeFileSync(QUERIES_FILE, JSON.stringify(queries, null, 2))
    console.log(`\n📄 Saved to: .audit-queries.json`)
  }

  // ── Step 4: Tavily search ────────────────────────────────────────────────────
  if (step === 4) {
    if (!fs.existsSync(QUERIES_FILE)) {
      console.error("Run step 3 first to generate queries.")
      process.exit(1)
    }
    const queries: string[] = JSON.parse(fs.readFileSync(QUERIES_FILE, "utf8"))

    console.log(`\n── Step 4: Tavily Search ─────────────────────────────────────`)
    console.log(`${queries.length} queries, 3 results each...\n`)

    const results = await tavilyBatchSearch(queries, 3, true)
    fs.writeFileSync(SEARCH_FILE, JSON.stringify(results, null, 2))

    console.log(`Total results: ${results.length}\n`)
    results.forEach(r => {
      const rcLen = (r.raw_content ?? "").length
      const tier = rcLen > 200 ? `raw_content ${rcLen}c` : `snippet only`
      console.log(`  [${r.score?.toFixed(2)}] ${r.title}`)
      console.log(`    URL    : ${r.url}`)
      console.log(`    Content: ${tier}`)
      console.log()
    })
    console.log(`📄 Saved to: .audit-search-results.json`)
  }

  // ── Step 5: Page scraping ────────────────────────────────────────────────────
  if (step === 5) {
    if (!fs.existsSync(SEARCH_FILE)) {
      console.error("Run step 4 first.")
      process.exit(1)
    }
    const searchResults = JSON.parse(fs.readFileSync(SEARCH_FILE, "utf8"))
    const urls: string[] = searchResults.map((r: any) => r.url)

    console.log(`\n── Step 5: Page Scraping ─────────────────────────────────────`)
    console.log(`Scraping ${urls.length} URLs...\n`)

    const scraped = await scrapeUrls(urls)
    scraped.forEach(r => {
      console.log(`  ✅ [${r.text.length}c] ${r.url}`)
      console.log(`     ${r.text.slice(0, 120).replace(/\n/g, " ")}...`)
      console.log()
    })

    const failed = urls.filter(u => !scraped.find(r => r.url === u))
    if (failed.length) {
      console.log(`  ⚠️  ${failed.length} failed — will use Tavily fallback:`)
      failed.forEach(u => console.log(`     - ${u}`))
    }

    fs.writeFileSync(SCRAPED_FILE, JSON.stringify(scraped, null, 2))
    console.log(`\n📄 Saved to: .audit-scraped.json`)
  }

  // ── Step 6: Experience extraction ───────────────────────────────────────────
  if (step === 6) {
    if (!fs.existsSync(SEARCH_FILE) || !fs.existsSync(SCRAPED_FILE)) {
      console.error("Run steps 4 and 5 first.")
      process.exit(1)
    }

    const searchResults = JSON.parse(fs.readFileSync(SEARCH_FILE, "utf8"))
    const scraped = JSON.parse(fs.readFileSync(SCRAPED_FILE, "utf8"))

    console.log(`\n── Step 6: Experience Extraction ────────────────────────────`)
    console.log(`Destination : ${dest}\n`)

    const annotated = annotateResults(searchResults, scraped)
    const totalChars = annotated.reduce((s, r) => s + r.content.length, 0)
    console.log(`Input: ${annotated.length} pages, ${totalChars} chars (~${Math.round(totalChars / 4)} tokens)\n`)

    const experiences = await extractExperiences(dest, annotated)

    console.log(`Extracted ${experiences.length} experiences:\n`)
    experiences.forEach(e => {
      console.log(`  [${e.category}] ${e.name}`)
      console.log(`  Location : ${e.location}`)
      e.key_facts?.forEach(f => console.log(`    • ${f}`))
      console.log()
    })

    fs.writeFileSync(EXPERIENCES_FILE, JSON.stringify(experiences, null, 2))
    console.log(`📄 Saved to: .audit-experiences.json`)
  }
}

function slug(dest: string): string {
  return dest.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

main().catch(err => { console.error(err); process.exit(1) })
