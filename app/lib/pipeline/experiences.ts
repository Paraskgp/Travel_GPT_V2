import { callLLM, Provider } from "../llm/client"
import { cacheRead, cacheWrite, TTL, CacheKey } from "../cache"
import {
  queryGeneratorSystemPrompt, queryGeneratorUserPrompt,
  extractFromPageSystemPrompt, extractFromPageUserPrompt,
  dedupSystemPrompt, dedupUserPrompt,
} from "../claude/prompts"
import { DestinationContext, RawExperience, GroundedExperience } from "../types"
import { tavilyBatchSearch, TavilyResult } from "../tavily/client"
import { scrapeUrl } from "../scraper/client"
import { parseJSON } from "../utils/parse-json"

// ─── Concurrency limit ────────────────────────────────────────────────────────
// Cap parallel Gemini calls in the map phase to avoid rate limits.
// 83 simultaneous calls would saturate the Gemini free-tier RPM limit.
const MAP_CONCURRENCY = 20

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ─── Sub-steps (exported for audit script) ────────────────────────────────────

/**
 * Stage 1: Generate targeted search queries for a destination.
 * 3 queries per applicable theme (broad + depth + corner case)
 * plus 5 cross-cutting queries (iconic, official data, food, logistics, recent tips).
 * When travelMonth is provided, adds 4 event-specific queries for that month.
 */
export async function generateQueries(
  dest: string,
  themes: string[],
  travelMonth: string | null = null,
  provider: Provider = "openai"
): Promise<string[]> {
  const raw = await callLLM(
    queryGeneratorSystemPrompt(),
    queryGeneratorUserPrompt(dest, themes, travelMonth),
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
 * Resolve the best available text content for a single search result.
 *
 * Priority:
 *   1. Tavily raw_content (full page text, uncapped) — available for most indexed pages
 *   2. Selective scrape — only triggered when raw_content is absent AND score >= 0.7
 *   3. Tavily snippet — always available, always prepended as a prefix
 *
 * Tavily raw_content is preferred over our own scrape because Tavily is uncapped
 * while our scraper caps at 4000 chars. For pages that block crawlers (Reddit,
 * Facebook), both Tavily and our scraper fail — snippet is the only option.
 */
async function resolveContent(result: TavilyResult): Promise<string> {
  const snippet = result.content ?? ""

  // Binary content guard for raw_content
  const rc = result.raw_content ?? ""
  const rcIsUsable = rc.length > 200
    && !rc.trimStart().startsWith("data:")
    && (rc.match(/[a-z ,.!?]/gi)?.length ?? 0) / rc.length > 0.4

  if (rcIsUsable) {
    // Prepend snippet — it often has clean restaurant/experience names from aggregator pages
    return `${snippet}\n\n${rc}`
  }

  // Selective scrape: only for high-signal URLs where Tavily has no raw_content
  if ((result.score ?? 0) >= 0.7) {
    try {
      const scraped = await scrapeUrl(result.url)
      if (scraped.ok && scraped.text.length > 200) {
        return `${snippet}\n\n${scraped.text}`
      }
    } catch {
      // scrape failed — fall through to snippet only
    }
  }

  return snippet
}

/**
 * Map phase: extract named experiences from a single search result page.
 * Returns [] on any failure — one bad page never aborts the map phase.
 */
// Cap content sent to the extractor. Beyond ~40k chars the additional content is typically
// navigation boilerplate, ads, or repeated section headers — not additional named experiences.
// Without a cap, high-content pages (e.g. 179k-char stroller guide, 115k-char travel blog)
// produce extractor output that overflows the 16384 token limit and returns partial JSON.
const CONTENT_MAX_CHARS = 40_000

export async function extractFromPage(
  result: TavilyResult,
  dest: string,
  provider: Provider = "openai"
): Promise<RawExperience[]> {
  const raw = await resolveContent(result)
  const content = raw.length > CONTENT_MAX_CHARS ? raw.slice(0, CONTENT_MAX_CHARS) : raw
  if (content.length < 50) return []

  try {
    const raw = await callLLM(
      extractFromPageSystemPrompt(),
      extractFromPageUserPrompt(dest, result.query ?? "", result.url, content),
      provider,
      "experience_extractor"
    )
    return parseJSON<RawExperience[]>(raw)
  } catch {
    return []
  }
}

/**
 * Pre-dedup by exact normalized name before the LLM dedup call.
 * "Angels Landing" appearing 20 times from 20 different pages → 1 candidate
 * with all 20 source URLs and the union of all key_facts.
 * This reduces the LLM input from ~500 candidates to ~80 unique names,
 * making the semantic dedup call fast and cheap.
 * The LLM still handles name variations ("Angel's Landing" vs "Angels Landing").
 */
function preDedupByName(candidates: RawExperience[]): RawExperience[] {
  const normalize = (name: string) =>
    name.toLowerCase().replace(/['''"]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

  const grouped = new Map<string, RawExperience & { _all_source_urls: string[] }>()

  for (const c of candidates) {
    const key = normalize(c.name)
    if (!grouped.has(key)) {
      grouped.set(key, { ...c, _all_source_urls: [c.source_url] })
    } else {
      const existing = grouped.get(key)!
      // Keep richest location (longer = more specific)
      if (c.location.length > existing.location.length) existing.location = c.location
      // Merge key_facts — union by content
      const factsSet = new Set(existing.key_facts)
      for (const f of c.key_facts) {
        if (!factsSet.has(f)) { factsSet.add(f); existing.key_facts.push(f) }
      }
      existing._all_source_urls.push(c.source_url)
    }
  }

  // Rebuild as RawExperience[] with deduplicated source URLs
  return Array.from(grouped.values()).map(({ _all_source_urls, ...c }) => ({
    ...c,
    source_url: [...new Set(_all_source_urls)].join(", "),
  }))
}

/**
 * Reduce phase: merge and deduplicate raw candidates extracted across all pages.
 *
 * Step 1 (deterministic): pre-dedup by normalized name — groups exact/near-exact name
 *   matches, merges key_facts, and builds a source_url map keyed by canonical name.
 *   Reduces ~500 candidates to ~80-100 unique names before the LLM sees anything.
 *
 * Step 2 (LLM): semantic dedup over the pre-grouped list — handles true name variations
 *   ("Angel's Landing" vs "Angels Landing") that the deterministic step can't catch.
 *   URLs are stripped from LLM input/output (they bloat the output — tracked in step 1).
 *
 * Step 3 (deterministic): reconstruct source_urls by fuzzy-matching the LLM's canonical
 *   names back to the pre-grouped map, then attach the collected URLs.
 *
 * This function is clean-swappable: embedding-based clustering could replace step 2
 * without changing callers.
 */
export async function dedupExperiences(
  candidates: RawExperience[],
  dest: string,
  provider: Provider = "openai"
): Promise<GroundedExperience[]> {
  if (candidates.length === 0) return []

  // Step 0: filter out clearly off-destination candidates
  // Candidates whose location doesn't reference the destination region are extraction
  // noise (e.g. "Yosemite National Park" extracted from an AccuWeather comparison page).
  const destWords = dest.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const relevant = candidates.filter(c => {
    const loc = c.location.toLowerCase()
    // Keep if location mentions any meaningful word from the destination name
    if (destWords.some(w => loc.includes(w))) return true
    // Keep if the name itself mentions a destination word (e.g. "Zion Canyon Shuttle")
    const name = c.name.toLowerCase()
    if (destWords.some(w => name.includes(w))) return true
    // Keep if no location at all (extractor may omit it for nearby items)
    return false
  })
  console.log(`[dedupExperiences] relevance filter: ${candidates.length} → ${relevant.length} candidates`)

  // Step 1: deterministic pre-dedup by normalized name
  const preGrouped = preDedupByName(relevant)
  console.log(`[dedupExperiences] pre-dedup: ${relevant.length} → ${preGrouped.length} candidates`)

  // Build URL lookup from pre-grouped list (keyed by normalized name)
  const normalize = (s: string) =>
    s.toLowerCase().replace(/['''"]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
  const urlsByName = new Map<string, string[]>()
  for (const c of preGrouped) {
    const key = normalize(c.name)
    // source_url is comma-joined list of all URLs collected during pre-dedup
    urlsByName.set(key, c.source_url.split(", ").filter(Boolean))
  }


  // Step 2: LLM semantic dedup — strip source_url from input, omit from output
  const llmInput = preGrouped.map(({ source_url: _ignored, ...rest }) => rest)
  const raw = await callLLM(
    dedupSystemPrompt(),
    dedupUserPrompt(llmInput, dest),
    provider,
    "experience_dedup"
  )
  const merged = parseJSON<Array<{ name: string; location: string; category: string; key_facts: string[] }>>(raw)

  // Step 3: reconstruct source_urls — match LLM canonical name back to pre-grouped map
  return merged.map(e => {
    const key = normalize(e.name)
    // Exact match first; fall back to fuzzy (find first pre-grouped entry whose normalized
    // name contains the LLM name or vice versa)
    let urls = urlsByName.get(key) ?? []
    if (urls.length === 0) {
      for (const [k, v] of urlsByName) {
        if (k.includes(key) || key.includes(k)) { urls = v; break }
      }
    }
    return { ...e, source_urls: [...new Set(urls)] }
  })
}

// ─── Full pipeline (used by generate route) ───────────────────────────────────

/**
 * Run the full grounding pipeline: queries → Tavily → map (parallel per-page
 * extraction) → reduce (LLM dedup) → cache.
 * Checks cache first. Non-fatal: returns [] on any failure so board generation continues.
 *
 * @param travelMonth - e.g. "September". When provided, adds event-specific search queries
 *   for sports tournaments, festivals, and concerts in that month. Also used to key the cache
 *   so event results don't bleed across months.
 */
export async function getExperiences(
  dest: string,
  destCtx: DestinationContext,
  travelMonth: string | null = null,
  provider: Provider = "openai"
): Promise<GroundedExperience[]> {
  // Cache key includes travel month so event-specific results are scoped to the right month
  const cacheKey: CacheKey = travelMonth
    ? `experiences_${travelMonth.toLowerCase().replace(/\s+/g, "_")}` as `experiences_${string}`
    : "experiences"

  const cached = cacheRead<GroundedExperience[]>(dest, cacheKey)
  if (cached) {
    console.log(`[pipeline/experiences] cache HIT — ${cached.length} experiences`)
    return cached
  }

  try {
    // Stage 1: queries (includes event queries when travelMonth is provided)
    const queries = await generateQueries(dest, destCtx.applicable_themes, travelMonth, provider)
    console.log(`[pipeline/experiences] ${queries.length} queries generated`)

    // Stage 2: search
    const searchResults = await tavilyBatchSearch(queries, 3, true)
    console.log(`[pipeline/experiences] ${searchResults.length} URLs from Tavily`)
    if (searchResults.length === 0) return []

    // Stage 3: map — extract from each page in parallel (capped concurrency)
    console.log(`[pipeline/experiences] map: extracting from ${searchResults.length} pages (${MAP_CONCURRENCY} at a time)...`)
    const settled = await runWithConcurrency(searchResults, MAP_CONCURRENCY, r => extractFromPage(r, dest, provider))

    const candidates: RawExperience[] = []
    let mapSuccesses = 0
    let mapFailures = 0
    for (const result of settled) {
      if (result.status === "fulfilled") {
        candidates.push(...result.value)
        mapSuccesses++
      } else {
        mapFailures++
      }
    }
    console.log(`[pipeline/experiences] map: ${mapSuccesses} pages OK, ${mapFailures} failed → ${candidates.length} raw candidates`)

    if (candidates.length === 0) return []

    // Stage 4: reduce — dedup and merge
    console.log(`[pipeline/experiences] reduce: deduplicating ${candidates.length} candidates...`)
    const experiences = await dedupExperiences(candidates, dest, provider)
    console.log(`[pipeline/experiences] ${experiences.length} experiences after dedup`)

    cacheWrite(dest, cacheKey, experiences, TTL.EXPERIENCES)
    return experiences
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pipeline/experiences] failed — continuing without grounding: ${msg.slice(0, 200)}`)
    return []
  }
}
