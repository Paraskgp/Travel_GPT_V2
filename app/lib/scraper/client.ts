/**
 * Lightweight HTML scraper — fetches a URL and returns clean readable text.
 *
 * No external dependencies. Uses Node's built-in fetch.
 *
 * Strategy:
 *   1. Fetch the raw HTML
 *   2. Remove noise blocks: <script>, <style>, <nav>, <footer>, <header>, <aside>
 *   3. Strip remaining HTML tags
 *   4. Decode HTML entities
 *   5. Collapse whitespace
 *
 * The result is the "article body" equivalent — just the meaningful text that
 * a human would read on the page. For NPS trail pages this gets us the trail
 * spec table, distance, elevation, accessibility notes. For restaurant pages
 * it gets us the about section, hours, neighborhood context.
 */

const FETCH_TIMEOUT_MS = 8000
const MAX_OUTPUT_CHARS = 4000

// Tags whose entire content we strip (including everything inside them)
const BLOCK_TAGS = ["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "svg"]

export interface ScrapeResult {
  url: string
  text: string        // clean extracted text, capped at MAX_OUTPUT_CHARS
  ok: boolean         // false = fetch failed or non-200
  error?: string      // set when ok=false
}

/**
 * Fetch a single URL and return clean text.
 * Never throws — returns ok=false on any error.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Identify as a browser to avoid simple bot blocks
        "User-Agent": "Mozilla/5.0 (compatible; TravelGPT/1.0; +https://travelgpt.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { url, text: "", ok: false, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const text = extractText(html)
    return { url, text: text.slice(0, MAX_OUTPUT_CHARS), ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { url, text: "", ok: false, error: msg.slice(0, 100) }
  }
}

/**
 * Scrape multiple URLs in parallel. Failed URLs are silently excluded.
 * Returns only successful results.
 */
export async function scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
  const results = await Promise.all(urls.map(scrapeUrl))
  return results.filter(r => r.ok && r.text.length > 100)
}

// ── HTML → plain text ────────────────────────────────────────────────────────

function extractText(html: string): string {
  let text = html

  // 1. Strip full blocks (tag + content)
  for (const tag of BLOCK_TAGS) {
    const re = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, "gi")
    text = text.replace(re, " ")
  }

  // 2. Convert block-level tags to newlines so sentences don't mash together
  text = text.replace(/<\/(p|div|li|h[1-6]|tr|td|th|section|article|main)>/gi, "\n")

  // 3. Strip all remaining tags
  text = text.replace(/<[^>]+>/g, " ")

  // 4. Decode HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))

  // 5. Collapse whitespace, preserve line breaks between blocks
  text = text
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length > 0)
    .join("\n")

  return text.trim()
}
