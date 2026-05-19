/**
 * Test: focused tip enhancement pass
 *
 * Takes an existing board JSON, runs a single focused LLM call per experience
 * to rewrite local_tip, and prints before/after comparison.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/test-tip-enhancement.ts \
 *     test_outputs/2026-05-19_11-54-03_yellowstone-national-park.json
 */

import fs from "fs"
import path from "path"
import OpenAI from "openai"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ""
const client = new OpenAI({ apiKey: OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are a hyper-specific travel tip writer. Your only job is to write one local_tip for a specific named travel experience.

Rules — non-negotiable:
- The tip must be impossible to detach from this exact named place. It cannot appear verbatim in a generic travel guide.
- BANNED phrases (do not write any of these): "arrive early", "bring binoculars", "book in advance", "book early", "wear comfortable shoes", "check the weather", "visit in the morning", "secure a good spot", "pack a picnic", "can get crowded", "during peak season", "small group sizes"
- DO write: a specific named pullout or viewpoint, an exact time window and why, what you'll see from a particular angle, the thing only repeat visitors know, a non-obvious access point, a specific geyser or feature within the larger area
- One or two sentences max. Concrete. Actionable. Tied to this exact place.
- Return ONLY the tip text. No JSON. No "Sure!" No explanation.`

function userPrompt(name: string, locationHint: string, destination: string, theme: string, currentTip: string): string {
  return `Write the best possible local_tip for this experience.

Experience: ${name}
Location: ${locationHint}
Destination: ${destination}
Theme: ${theme}
Current tip (likely too generic — do better): "${currentTip}"`
}

async function enhanceTip(
  name: string,
  locationHint: string,
  destination: string,
  theme: string,
  currentTip: string
): Promise<string> {
  const res = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 150,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(name, locationHint, destination, theme, currentTip) },
    ],
  })
  return res.choices[0]?.message?.content?.trim() ?? currentTip
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error("Usage: npx ts-node scripts/test-tip-enhancement.ts <board.json>")
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"))
  const board = raw.board
  const destination: string = board.destination

  // Flatten all experiences with their theme name
  const allExps = board.themes.flatMap((t: any) =>
    t.experiences.map((e: any) => ({ ...e, themeName: t.name }))
  )

  console.log(`\n🏔  Tip Enhancement Test — ${destination}`)
  console.log(`   ${allExps.length} experiences across ${board.themes.length} themes\n`)
  console.log("─".repeat(80))

  // Run all tip enhancements in parallel
  const results = await Promise.all(
    allExps.map(async (exp: any) => {
      const enhanced = await enhanceTip(
        exp.name,
        exp.location_hint ?? destination,
        destination,
        exp.themeName,
        exp.local_tip
      )
      return { name: exp.name, theme: exp.themeName, before: exp.local_tip, after: enhanced }
    })
  )

  // Print before/after for each
  for (const r of results) {
    console.log(`\n📍 ${r.name}  [${r.theme}]`)
    console.log(`   BEFORE: ${r.before}`)
    console.log(`   AFTER:  ${r.after}`)
  }

  console.log("\n" + "─".repeat(80))
  console.log(`\n✅ Done. ${results.length} tips enhanced.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
