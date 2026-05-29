import { callLLM, Provider } from "../llm/client"
import { Theme } from "../types"
import { parseJSON } from "../utils/parse-json"

const PROMPTS_DIR = require("path").join(process.cwd(), "prompts")
const fs = require("fs")

function loadPrompt(name: string): string {
  return fs.readFileSync(require("path").join(PROMPTS_DIR, name), "utf-8")
}

/**
 * Run a completeness audit on a fully generated board.
 *
 * Acts as a senior travel editor: reads all card names across all themes and
 * identifies named experiences that every serious guide to the destination covers
 * but that are completely absent from this board.
 *
 * Non-fatal: returns [] on any error so board delivery is never blocked.
 * Results are stored on Board.eval_gaps for logging and future UI use.
 *
 * @param destination - Destination name, e.g. "Tokyo, Japan"
 * @param themes - All themes from the completed board
 * @param provider - LLM provider to use
 * @returns Array of gap strings, e.g. ["Mount Fuji Day Trip — ..."]
 */
export async function evaluateBoard(
  destination: string,
  themes: Theme[],
  provider: Provider = "openai"
): Promise<string[]> {
  try {
    // Build a compact card list: just names grouped by theme — no full card data
    const cardList = themes
      .map(t => {
        const names = t.experiences.map(e => `  - ${e.name}`).join("\n")
        return `### ${t.name}\n${names}`
      })
      .join("\n\n")

    const userPrompt = [
      `## Destination\n\n${destination}`,
      `## Current board — all ${themes.flatMap(t => t.experiences).length} cards by theme\n\n${cardList}`,
      `## Your task\n\nWhat clearly belongs at ${destination} that is completely absent from this board? Return only valid JSON — a flat array of strings. Each string: "Experience name — one sentence reason". Max 8 gaps. Return [] if the board is complete.`,
    ].join("\n\n")

    const systemPrompt = loadPrompt("board-eval.md")
    const raw = await callLLM(systemPrompt, userPrompt, provider, "board_eval")
    const gaps = parseJSON<string[]>(raw)

    if (!Array.isArray(gaps)) return []
    return gaps.filter(g => typeof g === "string" && g.length > 0)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pipeline/board-eval] eval failed (non-fatal): ${msg.slice(0, 200)}`)
    return []
  }
}
