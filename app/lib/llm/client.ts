import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"

export type Provider = "openai" | "anthropic"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ""
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ""

const MODELS: Record<Provider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Extract retry-after seconds from OpenAI 429 error message
// e.g. "Please try again in 3.835s."
function parseRetryAfter(message: string): number {
  const match = message.match(/try again in ([\d.]+)s/i)
  if (match) return Math.ceil(parseFloat(match[1])) * 1000
  return 10_000 // default 10s
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  provider: Provider = "openai"
): Promise<string> {
  const model = MODELS[provider]

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: OPENAI_API_KEY })

    const MAX_RETRIES = 4
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: 16384, // gpt-4o max output
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        })
        const choice = response.choices[0]
        if (choice.finish_reason === "length") {
          console.warn("[callLLM] response cut off by max_tokens limit")
        }
        return choice?.message?.content ?? ""
      } catch (err: unknown) {
        lastError = err
        const isRateLimit =
          err instanceof OpenAI.APIError && err.status === 429
        if (!isRateLimit || attempt === MAX_RETRIES - 1) throw err

        const waitMs = parseRetryAfter(
          err instanceof OpenAI.APIError ? (err.message ?? "") : ""
        )
        console.warn(
          `[callLLM] OpenAI 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES - 1}`
        )
        await sleep(waitMs)
      }
    }

    throw lastError
  }

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    })
    return response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
  }

  throw new Error(`Unknown provider: ${provider}`)
}
