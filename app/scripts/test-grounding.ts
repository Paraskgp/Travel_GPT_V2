#!/usr/bin/env npx tsx
/**
 * Quick test: run just the grounding pipeline for a destination and print what we get.
 * Useful for diagnosing silent failures in the experiences extraction stage.
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
  const { callLLM } = await import('../lib/llm/client.js')
  const {
    destinationContextSystemPrompt, destinationContextUserPrompt,
    queryGeneratorSystemPrompt, queryGeneratorUserPrompt,
    experienceExtractorSystemPrompt, experienceExtractorUserPrompt,
  } = await import('../lib/claude/prompts.js')
  const { tavilyBatchSearch } = await import('../lib/tavily/client.js')
  const { scrapeUrls } = await import('../lib/scraper/client.js')

  const dest = process.argv[2] ?? "Zion National Park"
  const provider = "openai"

  function parseJSON<T>(raw: string): T {
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    return JSON.parse(stripped) as T
  }

  console.log(`\n🧪 Grounding pipeline test: ${dest}\n`)

  // Step 1: Destination context
  console.log('Step 1: Destination context...')
  let destContext: any
  try {
    const raw = await callLLM(destinationContextSystemPrompt(), destinationContextUserPrompt(dest), provider)
    destContext = parseJSON<any>(raw)
    console.log(`  ✅ Applicable themes: ${destContext.applicable_themes?.join(', ')}`)
  } catch (err) { console.error('  ❌ Failed:', err); process.exit(1) }

  // Step 2: Query generation
  console.log('\nStep 2: Query generation...')
  let queries: string[] = []
  try {
    const rawQueries = await callLLM(queryGeneratorSystemPrompt(), queryGeneratorUserPrompt(dest, destContext.applicable_themes), provider)
    queries = parseJSON<string[]>(rawQueries)
    console.log(`  ✅ Generated ${queries.length} queries:`)
    queries.forEach((q, i) => console.log(`     ${i+1}. ${q}`))
  } catch (err) { console.error('  ❌ Failed:', err); process.exit(1) }

  // Step 3: Tavily search
  console.log('\nStep 3: Tavily batch search...')
  let searchResults: any[] = []
  try {
    searchResults = await tavilyBatchSearch(queries, 3, true)
    console.log(`  ✅ ${searchResults.length} results`)
    searchResults.forEach(r => {
      console.log(`     [${r.score?.toFixed(2)}] ${r.title?.slice(0, 55)} | raw: ${(r.raw_content ?? '').length} chars`)
    })
  } catch (err) { console.error('  ❌ Failed:', err); process.exit(1) }

  // Step 4: Scrape pages
  console.log('\nStep 4: Scraping pages...')
  const urls = searchResults.map((r: any) => r.url)
  let scraped: any[] = []
  try {
    scraped = await scrapeUrls(urls)
    console.log(`  ✅ Scraped ${scraped.length}/${urls.length} pages`)
  } catch (err) { console.error('  ❌ Failed:', err); process.exit(1) }

  // Step 5: Build annotated results
  const scrapedByUrl = new Map(scraped.map((r: any) => [r.url, r]))
  const annotatedResults = searchResults.map((r: any) => {
    const scrapeResult = scrapedByUrl.get(r.url)
    const snippet = r.content ?? ""
    let pageContent = ""
    if (scrapeResult?.ok && scrapeResult.text.length > 200) {
      pageContent = scrapeResult.text
    } else {
      const rc = r.raw_content ?? ""
      const looksLikeText = rc.length > 200 && !rc.trimStart().startsWith("data:")
        && (rc.match(/[a-z ,.!?]/gi)?.length ?? 0) / rc.length > 0.4
      if (looksLikeText) pageContent = rc.slice(0, 3500)
    }
    const content = pageContent ? `${snippet}\n\n${pageContent}` : snippet
    return { query: r.query ?? "", title: r.title, url: r.url, content }
  }).filter((r: any) => r.content.length > 50)

  console.log(`\n  ✅ Annotated results: ${annotatedResults.length}`)
  const totalChars = annotatedResults.reduce((s: number, r: any) => s + r.content.length, 0)
  console.log(`  Total content: ${totalChars} chars (~${Math.round(totalChars/4)} tokens)`)
  annotatedResults.forEach((r: any) => {
    const tier = (scrapedByUrl.get(r.url)?.ok && scrapedByUrl.get(r.url)?.text.length > 200) ? 'scrape' : r.content.length > 300 ? 'tavily-raw' : 'snippet'
    console.log(`     [${tier}] ${r.title?.slice(0, 50)} | ${r.content.length}c`)
  })

  // Step 6: Extract experiences
  console.log('\nStep 6: Experience extraction...')
  try {
    const rawExtracted = await callLLM(
      experienceExtractorSystemPrompt(),
      experienceExtractorUserPrompt(dest, annotatedResults),
      provider
    )
    console.log(`  LLM raw output (first 300 chars):\n  ${rawExtracted.slice(0, 300)}`)
    const experiences = parseJSON<any[]>(rawExtracted)
    console.log(`\n  ✅ Extracted ${experiences.length} experiences:`)
    experiences.forEach(e => console.log(`     [${e.category}] ${e.name} — ${e.key_facts?.length} facts`))
  } catch (err) {
    console.error('  ❌ Failed:', err)
    if (err instanceof Error) console.error('  Detail:', err.message)
  }
}

main().catch(console.error)
