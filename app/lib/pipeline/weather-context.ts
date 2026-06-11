import { callLLM, Provider } from "../llm/client"
import { cacheRead, cacheWrite, TTL, weatherPromptHash } from "../cache"
import { weatherContextSystemPrompt, weatherContextUserPrompt } from "../claude/prompts"
import { WeatherContext } from "../types"
import { parseJSON } from "../utils/parse-json"

/**
 * Get weather context for a destination + month.
 *
 * @param dest        - Destination name e.g. "Zion National Park"
 * @param monthLabel  - Human label passed to LLM e.g. "November 2026"
 * @param monthSlug   - Cache key slug e.g. "november"
 * @param provider
 *
 * Non-fatal: returns null on failure so the pipeline can continue without weather.
 */
export async function getWeatherContext(
  dest: string,
  monthLabel: string,
  monthSlug: string,
  provider: Provider = "openai"
): Promise<WeatherContext | null> {
  const key = `weather_${monthSlug}` as const
  const wxHash = weatherPromptHash()
  const cached = cacheRead<WeatherContext>(dest, key, wxHash)
  if (cached) return cached

  try {
    const raw = await callLLM(
      weatherContextSystemPrompt(),
      weatherContextUserPrompt(dest, monthLabel),
      provider,
      "weather_context"
    )
    const ctx = parseJSON<WeatherContext>(raw)
    cacheWrite(dest, key, ctx, TTL.WEATHER, wxHash)
    return ctx
  } catch (err) {
    console.warn("[pipeline/weather] failed — continuing without it:", err)
    return null
  }
}
