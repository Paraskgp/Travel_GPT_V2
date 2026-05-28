/**
 * Tavily search client — thin wrapper around the Tavily API.
 *
 * Docs: https://docs.tavily.com/docs/tavily-api/rest_api
 * Cost: $0.01 / search (basic), $0.02 / search (advanced)
 *
 * We use `include_raw_content: true` to get the actual scraped page text
 * rather than Tavily's short snippet (~150 chars). The raw content gives us
 * the full trail distances, elevation tables, hours, and accessibility info
 * that live in the middle of NPS and AllTrails pages — content that never
 * makes it into the short snippet.
 *
 * Usage:
 *   const results = await tavilySearch("Zion National Park stroller accessible trails")
 *   // returns array of {title, url, content, raw_content, score}
 */

const TAVILY_API_URL = "https://api.tavily.com/search"

export interface TavilyResult {
  title: string
  url: string
  content: string       // Tavily's short snippet (~150 chars) — fallback if raw_content missing
  raw_content?: string  // Full scraped page text (available when include_raw_content: true)
  score: number         // relevance score 0–1
  query?: string        // set by tavilyBatchSearch — the query that produced this result
}

export interface TavilySearchResponse {
  query: string
  results: TavilyResult[]
  answer?: string   // Tavily's AI-generated answer (when available)
}

/**
 * Run a single Tavily search. Returns up to `maxResults` results.
 * Throws on network error or non-200 response.
 *
 * `includeRawContent: true` (default) — returns the full scraped page text
 * in `raw_content`. More tokens to the extractor but far more factual data.
 * Set to false only when you need low latency and don't need specific facts.
 */
export async function tavilySearch(
  query: string,
  maxResults = 5,
  includeRawContent = false   // default OFF — we fetch pages ourselves in Stage 2
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set")

  const res = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",           // "advanced" = 2× cost, not needed when we have raw_content
      include_answer: false,           // skip AI summary — we extract ourselves
      include_raw_content: includeRawContent,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Tavily API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data: TavilySearchResponse = await res.json()
  return data.results ?? []
}

/**
 * Run multiple Tavily searches in parallel. Returns a flat list of all results,
 * deduplicated by URL. Failed individual queries are logged and skipped.
 */
export async function tavilyBatchSearch(
  queries: string[],
  maxResultsPerQuery = 5,
  includeRawContent = false   // default OFF — we fetch pages ourselves in Stage 2
): Promise<TavilyResult[]> {
  const settled = await Promise.allSettled(
    queries.map(q => tavilySearch(q, maxResultsPerQuery, includeRawContent))
  )

  const seen = new Set<string>()
  const results: TavilyResult[] = []

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      for (const r of result.value) {
        if (!seen.has(r.url)) {
          seen.add(r.url)
          results.push({ ...r, query: queries[i] })  // carry the originating query
        }
      }
    } else {
      console.warn(`[tavily] query ${i} failed: ${queries[i]?.slice(0, 60)} →`, result.reason)
    }
  })

  return results
}
