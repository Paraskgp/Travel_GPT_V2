import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"

export type Provider = "openai" | "anthropic"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ""
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ""

const MODELS: Record<Provider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  provider: Provider = "openai"
): Promise<string> {
  const model = MODELS[provider]

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: OPENAI_API_KEY })
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
