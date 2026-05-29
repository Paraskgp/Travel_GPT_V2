#!/usr/bin/env npx tsx
/**
 * Quick test: run the day_trips theme prompt directly against the Tokyo
 * destination context and print what cards the LLM generates.
 *
 * Usage: npx tsx scripts/test-day-trips.ts
 */

import { themeSystemPrompt, themeUserPrompt } from "../lib/claude/prompts"
import { callLLM } from "../lib/llm/client"
import { cacheRead } from "../lib/cache"
import { DestinationContext, WeatherContext, Theme } from "../lib/types"
import { parseJSON } from "../lib/utils/parse-json"

const dest = "Tokyo, Japan"

async function main() {
  const destCtx = cacheRead<DestinationContext>(dest, "destination_context")
  if (!destCtx) {
    console.error("No destination context cached for", dest)
    process.exit(1)
  }

  const weatherCtx = cacheRead<WeatherContext>(dest, "weather_september")

  console.log(`\nRunning day_trips theme prompt directly against: ${dest}`)
  console.log(`─`.repeat(60))

  const raw = await callLLM(
    themeSystemPrompt(),
    themeUserPrompt("day_trips", dest, destCtx, weatherCtx, {}, [], []),
    "openai",
    "board_generation"
  )

  const theme = parseJSON<Theme>(raw)

  console.log(`\n${theme.name}: ${theme.description}`)
  console.log(`─`.repeat(60))
  theme.experiences.forEach((exp, i) => {
    console.log(`\n${i + 1}. ${exp.name}`)
    console.log(`   location_hint: ${exp.location_hint}`)
    console.log(`   duration: ${exp.duration}`)
    console.log(`   why: ${exp.why_worth_it}`)
  })
}

main().catch(err => { console.error(err); process.exit(1) })
