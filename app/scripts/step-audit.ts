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
 *   npx tsx scripts/step-audit.ts 4                          # reads .audit-queries.json
 *   npx tsx scripts/step-audit.ts 5                          # reads .audit-search-results.json
 *   npx tsx scripts/step-audit.ts 6 "Zion National Park"    # reads .audit-search-results.json → map → reduce
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
const QUERIES_FILE     = path.join(ROOT, ".audit-queries.json")
const SEARCH_FILE      = path.join(ROOT, ".audit-search-results.json")
const MAP_FILE         = path.join(ROOT, ".audit-map-results.json")
const EXPERIENCES_FILE = path.join(ROOT, ".audit-experiences.json")

async function main() {
  const { getDestinationContext }                          = await import("../lib/pipeline/destination-context.js")
  const { getWeatherContext }                              = await import("../lib/pipeline/weather-context.js")
  const { generateQueries, extractFromPage, dedupExperiences } = await import("../lib/pipeline/experiences.js")
  const { tavilyBatchSearch }                              = await import("../lib/tavily/client.js")

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

    const withRawContent = results.filter(r => (r.raw_content ?? "").length > 200).length
    console.log(`Total results: ${results.length}  (${withRawContent} with raw_content, ${results.length - withRawContent} snippet-only)\n`)
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

  // ── Step 5: Content preview (replaces blanket scraping) ─────────────────────
  // Shows which content source each result will use in the map phase.
  // Selective scraping (for high-score pages missing raw_content) happens
  // inside extractFromPage during step 6 — not as a separate blanket pass.
  if (step === 5) {
    if (!fs.existsSync(SEARCH_FILE)) {
      console.error("Run step 4 first.")
      process.exit(1)
    }
    const searchResults = JSON.parse(fs.readFileSync(SEARCH_FILE, "utf8"))

    console.log(`\n── Step 5: Content Source Preview ───────────────────────────`)
    console.log(`(Blanket scraping removed — content resolved per-page in map phase)\n`)

    let rawCount = 0, snippetCount = 0, scrapeCount = 0

    for (const r of searchResults) {
      const rcLen = (r.raw_content ?? "").length
      const hasRc = rcLen > 200
        && !String(r.raw_content ?? "").trimStart().startsWith("data:")
        && ((String(r.raw_content ?? "").match(/[a-z ,.!?]/gi)?.length ?? 0) / rcLen) > 0.4

      let source: string
      if (hasRc) {
        source = `✅ tavily raw_content (${rcLen}c)`
        rawCount++
      } else if ((r.score ?? 0) >= 0.7) {
        source = `🔍 selective scrape (score=${r.score?.toFixed(2)})`
        scrapeCount++
      } else {
        source = `⚠️  snippet only (score=${r.score?.toFixed(2)})`
        snippetCount++
      }
      console.log(`  ${source}`)
      console.log(`    ${r.url}`)
      console.log()
    }

    console.log(`Summary: ${rawCount} raw_content, ${scrapeCount} selective scrapes, ${snippetCount} snippet-only`)
    console.log(`\nNo file saved — content resolved live in step 6 map phase.`)
  }

  // ── Step 6: Experience extraction (map → reduce) ─────────────────────────────
  if (step === 6) {
    if (!fs.existsSync(SEARCH_FILE)) {
      console.error("Run step 4 first.")
      process.exit(1)
    }

    const searchResults = JSON.parse(fs.readFileSync(SEARCH_FILE, "utf8"))

    console.log(`\n── Step 6: Experience Extraction (map → reduce) ─────────────`)
    console.log(`Destination : ${dest}`)
    console.log(`Pages       : ${searchResults.length}\n`)

    // Map phase
    console.log(`── Map: extracting from ${searchResults.length} pages in parallel...\n`)
    const MAP_CONCURRENCY = 20
    const allCandidates: any[] = []
    let mapOk = 0, mapFail = 0

    for (let i = 0; i < searchResults.length; i += MAP_CONCURRENCY) {
      const batch = searchResults.slice(i, i + MAP_CONCURRENCY)
      const settled = await Promise.allSettled(batch.map((r: any) => extractFromPage(r, dest)))
      settled.forEach((result, j) => {
        const r = batch[j]
        if (result.status === "fulfilled") {
          const count = result.value.length
          if (count > 0) {
            console.log(`  ✅ [${count} found] ${r.url}`)
            result.value.forEach((e: any) => console.log(`       • ${e.name} (${e.category})`))
          } else {
            console.log(`  — [0 found] ${r.url}`)
          }
          allCandidates.push(...result.value)
          mapOk++
        } else {
          console.log(`  ❌ [failed] ${r.url}`)
          mapFail++
        }
      })
    }

    console.log(`\nMap result: ${mapOk} pages OK, ${mapFail} failed → ${allCandidates.length} raw candidates`)
    fs.writeFileSync(MAP_FILE, JSON.stringify(allCandidates, null, 2))
    console.log(`📄 Saved to: .audit-map-results.json`)

    if (allCandidates.length === 0) {
      console.log("No candidates — skipping reduce phase.")
      return
    }

    // Reduce phase
    console.log(`\n── Reduce: deduplicating ${allCandidates.length} candidates...\n`)
    const experiences = await dedupExperiences(allCandidates, dest)

    console.log(`Deduplicated to ${experiences.length} experiences:\n`)
    experiences.forEach((e: any) => {
      console.log(`  [${e.category}] ${e.name}`)
      console.log(`  Location : ${e.location}`)
      e.key_facts?.forEach((f: string) => console.log(`    • ${f}`))
      if (e.source_urls?.length > 1) console.log(`  Sources  : ${e.source_urls.length} pages`)
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
