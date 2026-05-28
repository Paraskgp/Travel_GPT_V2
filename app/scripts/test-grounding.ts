#!/usr/bin/env npx tsx
/**
 * Quick test: run the grounding pipeline for a destination and print what we get.
 * Calls the same production functions as the generate route — no reimplementation.
 *
 * Usage:
 *   npx tsx scripts/test-grounding.ts "Zion National Park"
 */
import fs from 'fs'
import path from 'path'

// Load env
const envFile = path.resolve(import.meta.dirname, '../.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

async function main() {
  const { getDestinationContext } = await import('../lib/pipeline/destination-context.js')
  const { getExperiences }        = await import('../lib/pipeline/experiences.js')

  const dest = process.argv[2] ?? "Zion National Park"

  console.log(`\n🧪 Grounding pipeline test: ${dest}\n`)

  const destCtx = await getDestinationContext(dest)
  console.log(`Destination context: themes = ${destCtx.applicable_themes.join(', ')}\n`)

  const experiences = await getExperiences(dest, destCtx)

  if (experiences.length === 0) {
    console.log('❌ No experiences returned — check logs above for errors.')
    process.exit(1)
  }

  console.log(`\n✅ ${experiences.length} grounded experiences:\n`)
  experiences.forEach(e => {
    console.log(`  [${e.category}] ${e.name}`)
    console.log(`  Location : ${e.location}`)
    e.key_facts.forEach(f => console.log(`    • ${f}`))
    if (e.source_urls.length > 1) console.log(`  Sources  : ${e.source_urls.length} pages`)
    console.log()
  })
}

main().catch(err => { console.error(err); process.exit(1) })
