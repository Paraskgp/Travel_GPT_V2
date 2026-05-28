import { callLLM, Provider } from "../llm/client"
import { cacheRead, cacheWrite, TTL } from "../cache"
import {
  queryGeneratorSystemPrompt, queryGeneratorUserPrompt,
  experienceExtractorSystemPrompt, experienceExtractorUserPrompt,
} from "../claude/prompts"
import { DestinationContext, GroundedExperience } from "../types"
import { tavilyBatchSearch, TavilyResult } from "../tavily/client"
import { scrapeUrls, ScrapeResult } from "../scraper/client"
import { parseJSON } from "../utils/parse-json"

export interface AnnotatedResult {
  query: string
  title: string
  url: string
  content: string
}

// ─── Sub-steps (exported for audit script) ────────────────────────────────────

/**
 * Stage 1: Generate targeted search queries for a destination.
 * 3 queries per applicable theme (broad + depth + corner case)
 * plus 5 cross-cutting queries (iconic experience, official data, food, logistics, recent tips).
 */
export async function generateQueries(
  dest: string,
  themes: string[],
  provider: Provider = "openai"
): Promise<string[]> {
  const raw = await callLLM(
    queryGeneratorSystemPrompt(),
    queryGeneratorUserPrompt(dest, themes),
    provider,
    "query_generator"
  )
  try {
    return parseJSON<string[]>(raw)
  } catch {
    // Fallback: parse line-by-line if LLM wrapped in prose instead of JSON
    return raw
      .split("\n")
      .map(l => l.replace(/^[\d\-\.\*\s"]+/, "").replace(/",$/, "").trim())
      .filter(l => l.length > 5)
  }
}

/**
 * Stage 3 (pure transform): Combine Tavily search results with scraped page text
 * into annotated results ready for the experience extractor.
 *
 * Content priority per result:
 *   1. Our own scraped text  — clean, no nav/footer noise
 *   2. Tavily raw_content    — handles JS-rendered pages (Yelp, TripAdvisor)
 *      Guard: skipped if raw_content is binary/base64
 *   3. Tavily short snippet  — always prepended; carries restaurant names from
 *      aggregator pages even when the full page is inaccessible
 */
export function annotateResults(
  searchResults: TavilyResult[],
  scraped: ScrapeResult[]
): AnnotatedResult[] {
  const scrapedByUrl = new Map(scraped.map(r => [r.url, r]))

  return searchResults.map(r => {
    const scrapeResult = scrapedByUrl.get(r.url)
    const snippet = r.content ?? ""

    let pageContent = ""
    if (scrapeResult?.ok && scrapeResult.text.length > 200) {
      pageContent = scrapeResult.text
    } else {
      const rc = r.raw_content ?? ""
      const looksLikeText = rc.length > 200
        && !rc.trimStart().startsWith("data:")
        && (rc.match(/[a-z ,.!?]/gi)?.length ?? 0) / rc.length > 0.4
      if (looksLikeText) pageContent = rc.slice(0, 3500)
    }

    return {
      query: r.query ?? "",
      title: r.title,
      url: r.url,
      content: pageContent ? `${snippet}\n\n${pageContent}` : snippet,
    }
  }).filter(r => r.content.length > 50)
}

/**
 * Stage 4: Extract verified experiences from annotated search results.
 */
export async function extractExperiences(
  dest: string,
  annotatedResults: AnnotatedResult[],
  provider: Provider = "openai"
): Promise<GroundedExperience[]> {
  const raw = await callLLM(
    experienceExtractorSystemPrompt(),
    experienceExtractorUserPrompt(dest, annotatedResults),
    provider,
    "experience_extractor"
  )
  return parseJSON<GroundedExperience[]>(raw)
}

// ─── Full pipeline (used by generate route) ───────────────────────────────────

/**
 * Run the full grounding pipeline: queries → Tavily → scrape → extract → cache.
 * Checks cache first. Non-fatal: returns [] on any failure so board generation continues.
 */
export async function getExperiences(
  dest: string,
  destCtx: DestinationContext,
  provider: Provider = "openai"
): Promise<GroundedExperience[]> {
  const cached = cacheRead<GroundedExperience[]>(dest, "experiences")
  if (cached) {
    console.log(`[pipeline/experiences] cache HIT — ${cached.length} experiences`)
    return cached
  }

  try {
    const queries = await generateQueries(dest, destCtx.applicable_themes, provider)
    console.log(`[pipeline/experiences] ${queries.length} queries generated`)

    const searchResults = await tavilyBatchSearch(queries, 3, true)
    console.log(`[pipeline/experiences] ${searchResults.length} URLs from Tavily`)

    if (searchResults.length === 0) return []

    const urls = searchResults.map(r => r.url)
    const scraped = await scrapeUrls(urls)
    console.log(`[pipeline/experiences] scraped ${scraped.length}/${urls.length} pages`)

    const annotated = annotateResults(searchResults, scraped)
    if (annotated.length === 0) return []

    const experiences = await extractExperiences(dest, annotated, provider)
    console.log(`[pipeline/experiences] extracted ${experiences.length} experiences`)

    cacheWrite(dest, "experiences", experiences, TTL.EXPERIENCES)
    return experiences
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pipeline/experiences] failed — continuing without grounding: ${msg.slice(0, 200)}`)
    return []
  }
}
