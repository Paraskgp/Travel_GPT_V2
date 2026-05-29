import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"

export type Provider = "openai" | "anthropic" | "gemini"

// Stage-level routing: some stages need quality (board gen), others just need speed + cost.
// Pass a stage hint to callLLM to get the right model automatically.
export type Stage =
  | "destination_normalization" // raw input → canonical name — cheap, tiny output (≤50 tokens)
  | "query_generator"           // generates search queries — cheap
  | "experience_extractor"      // extracts facts from a single page (map phase) — cheap, small output
  | "experience_dedup"          // merges raw candidates into canonical list (reduce phase) — cheap
  | "tip_enhancement"           // rewrites a single local tip — cheap
  | "board_generation"          // generates experience cards — quality matters, keep strong model
  | "board_eval"                // completeness audit — senior editor gap detection, moderate quality
  | "destination_context"       // destination metadata — moderate quality needed
  | "weather_context"           // weather summary — cheap
  | "default"

const OPENAI_API_KEY    = process.env.OPENAI_API_KEY    ?? ""
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ""
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? ""

// ── Model registry ─────────────────────────────────────────────────────────────

const MODELS: Record<Provider, string> = {
  openai:    "gpt-4o",
  anthropic: "claude-sonnet-4-5",
  gemini:    "gemini-2.5-flash",
}

// ── Stage → provider routing ───────────────────────────────────────────────────
//
// Cheap stages (query gen, extractor, tips) → Gemini 2.5 Flash
//   - $0.10/1M input vs $2.50/1M for GPT-4o (25× cheaper)
//   - 1M context window — ideal for experience extractor with many scraped pages
//   - No quality difference visible in the product for these stages
//
// Board generation → GPT-4o (default) or Claude
//   - This is what users see. DeepSeek V3 / Gemini 2.5 Flash Pro are candidates
//     once validated via eval-board.ts head-to-head. See PRODUCT_SPEC.md open items.
//
// Falls back to the explicitly passed provider if no stage routing applies.
//
function resolveProvider(provider: Provider, stage?: Stage): Provider {
  if (!stage || stage === "default") return provider

  // Cheap stages: use Gemini if key is available, otherwise fall back to passed provider
  const cheapStages: Stage[] = ["destination_normalization", "query_generator", "experience_extractor", "experience_dedup", "tip_enhancement", "weather_context", "destination_context"]
  if (cheapStages.includes(stage) && GOOGLE_AI_API_KEY) return "gemini"

  return provider
}

// ── Stage → max output tokens ─────────────────────────────────────────────────
//
// experience_extractor (map phase): one page at a time → small output, 8192 is fine.
//   Previous architecture sent all 83 pages in one call and needed 32768. Map-reduce
//   removes that problem — each map call processes ~4k chars and outputs 1–8 experiences.
//
// experience_dedup (reduce phase): input is ~200-400 compact RawExperience objects
//   (names + locations + facts, no HTML) → ~20k token input, ~5k token output.
//   8192 is sufficient for output.
//
// All other stages: 8192 is sufficient — tips are 1-2 sentences, queries are
//   short strings, board cards are batched per theme.
//
function resolveMaxTokens(resolvedProvider: Provider, stage?: Stage): number {
  // destination_normalization: visible output is just a destination name (~10 tokens),
  // but Gemini 2.5 Flash uses thinking tokens before producing visible output, which
  // consumes from the max_tokens budget. 1024 gives sufficient headroom for thinking
  // while keeping cost near-zero for this tiny output.
  if (stage === "destination_normalization") return 1024
  // experience_dedup: Gemini 2.5 Flash uses internal thinking tokens before producing
  // output, which consumes from the max_tokens budget. Setting 65536 (the model max)
  // ensures the actual JSON output is never cut short even with heavy thinking overhead.
  if (resolvedProvider === "gemini" && stage === "experience_dedup") return 65536
  // experience_extractor: high-value pages (e.g. tour operator booking pages) can produce
  // 30+ experiences with detailed pricing and schedules. Gemini 2.5 Flash uses thinking tokens
  // against the max_tokens budget before producing visible output — 16384 was still insufficient
  // for dense pages like undercanvas.com (30 tours × pricing + dates). 32768 provides sufficient
  // headroom. At $0.10/1M input tokens the cost increase per pipeline run is under $0.30.
  if (resolvedProvider === "gemini" && stage === "experience_extractor") return 32768
  if (resolvedProvider === "gemini") return 8192
  if (resolvedProvider === "openai") return 16384
  return 16000  // anthropic
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function parseRetryAfter(message: string): number {
  const match = message.match(/try again in ([\d.]+)s/i)
  if (match) return Math.ceil(parseFloat(match[1])) * 1000
  return 10_000
}

// ── callLLM ──────────────────────────────────────────────────────────────────

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  provider: Provider = "openai",
  stage?: Stage
): Promise<string> {
  const resolvedProvider = resolveProvider(provider, stage)
  const model = MODELS[resolvedProvider]
  const maxTokens = resolveMaxTokens(resolvedProvider, stage)

  // ── OpenAI ──────────────────────────────────────────────────────────────────
  if (resolvedProvider === "openai") {
    const client = new OpenAI({ apiKey: OPENAI_API_KEY })
    const MAX_RETRIES = 4
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userPrompt },
          ],
        })
        const choice = response.choices[0]
        if (choice.finish_reason === "length") {
          console.warn("[callLLM] response cut off by max_tokens limit")
        }
        return choice?.message?.content ?? ""
      } catch (err: unknown) {
        lastError = err
        const isRateLimit = err instanceof OpenAI.APIError && err.status === 429
        if (!isRateLimit || attempt === MAX_RETRIES - 1) throw err
        const waitMs = parseRetryAfter(err instanceof OpenAI.APIError ? (err.message ?? "") : "")
        console.warn(`[callLLM] OpenAI 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES - 1}`)
        await sleep(waitMs)
      }
    }
    throw lastError
  }

  // ── Gemini (via OpenAI-compatible endpoint) ───────────────────────────────
  // Google exposes a /v1beta/openai/ endpoint that accepts OpenAI SDK calls.
  // No new SDK dependency needed.
  if (resolvedProvider === "gemini") {
    const client = new OpenAI({
      apiKey: GOOGLE_AI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    })
    const MAX_RETRIES = 3
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userPrompt },
          ],
        })
        const choice = response.choices[0]
        if (choice.finish_reason === "length") {
          console.warn("[callLLM] Gemini response cut off by max_tokens limit")
        }
        return choice?.message?.content ?? ""
      } catch (err: unknown) {
        lastError = err
        // Gemini 429s look like OpenAI 429s through the compat layer
        const isRateLimit = err instanceof OpenAI.APIError && err.status === 429
        if (!isRateLimit || attempt === MAX_RETRIES - 1) throw err
        const waitMs = parseRetryAfter(err instanceof OpenAI.APIError ? (err.message ?? "") : "")
        console.warn(`[callLLM] Gemini 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES - 1}`)
        await sleep(waitMs)
      }
    }
    throw lastError
  }

  // ── Anthropic ─────────────────────────────────────────────────────────────
  if (resolvedProvider === "anthropic") {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    })
    return response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
  }

  throw new Error(`Unknown provider: ${resolvedProvider}`)
}
