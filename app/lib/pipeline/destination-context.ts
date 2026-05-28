import { callLLM, Provider } from "../llm/client"
import { cacheRead, cacheWrite, TTL } from "../cache"
import { destinationContextSystemPrompt, destinationContextUserPrompt } from "../claude/prompts"
import { DestinationContext } from "../types"
import { parseJSON } from "../utils/parse-json"

/**
 * Get destination context for a destination.
 * Checks cache first. On miss: calls LLM, writes to cache, returns result.
 * Throws on failure — caller decides how to handle.
 */
export async function getDestinationContext(
  dest: string,
  provider: Provider = "openai"
): Promise<DestinationContext> {
  const cached = cacheRead<DestinationContext>(dest, "destination_context")
  if (cached) return cached

  const raw = await callLLM(
    destinationContextSystemPrompt(),
    destinationContextUserPrompt(dest),
    provider,
    "destination_context"
  )
  const ctx = parseJSON<DestinationContext>(raw)
  cacheWrite(dest, "destination_context", ctx, TTL.DESTINATION_CONTEXT)
  return ctx
}
