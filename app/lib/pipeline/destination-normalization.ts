import { callLLM, Provider } from "../llm/client"
import { cacheRead, cacheWrite, TTL } from "../cache"
import { destinationNormalizationSystemPrompt, destinationNormalizationUserPrompt } from "../claude/prompts"

/**
 * Resolve any raw user-typed destination string to a canonical, fully-qualified name.
 *
 * Examples:
 *   "Zion"        → "Zion National Park"
 *   "Zion NP"     → "Zion National Park"
 *   "Xayan"       → "Zion National Park"  (misspelling corrected)
 *   "NYC"         → "New York City"
 *   "The Narrows" → "Zion National Park"  (sub-location → parent destination)
 *   "paris"       → "Paris, France"
 *
 * The canonical name is used as `dest` for all downstream pipeline calls so that
 * "Zion", "Zion NP", and "Zion National Park" all hit the same cache entry.
 *
 * Non-fatal: returns the raw input on any LLM failure so the pipeline continues.
 */
export async function normalizeDestination(
  raw: string,
  provider: Provider = "openai"
): Promise<string> {
  // Cache keyed by raw input — permanent, canonical names never change
  const cached = cacheRead<string>(raw, "canonical_name")
  if (cached) {
    console.log(`[pipeline/normalize] cache HIT — "${raw}" → "${cached}"`)
    return cached
  }

  try {
    const canonical = await callLLM(
      destinationNormalizationSystemPrompt(),
      destinationNormalizationUserPrompt(raw),
      provider,
      "destination_normalization"
    )

    const result = canonical.trim().replace(/["""'''.]+$/g, "").trim()

    if (!result) {
      console.warn(`[pipeline/normalize] empty response for "${raw}" — using raw input`)
      return raw
    }

    console.log(`[pipeline/normalize] "${raw}" → "${result}"`)
    cacheWrite(raw, "canonical_name", result, TTL.CANONICAL_NAME)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pipeline/normalize] failed for "${raw}" — using raw input: ${msg.slice(0, 100)}`)
    return raw
  }
}
