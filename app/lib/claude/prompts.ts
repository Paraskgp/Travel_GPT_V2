import fs from "fs"
import path from "path"
import { Preferences, DestinationContext, WeatherContext, Board, Experience } from "../types"

const PROMPTS_DIR = path.join(process.cwd(), "prompts")

function load(relativePath: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, relativePath), "utf-8")
}

function loadTheme(themeId: string): string {
  const p = path.join(PROMPTS_DIR, "themes", `${themeId}.md`)
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : ""
}

// ─── Node 1: Destination Context ─────────────────────────────────────────────

export function destinationContextSystemPrompt(): string {
  return load("destination-context.md")
}

export function destinationContextUserPrompt(destination: string): string {
  return `Generate the destination context for: **${destination}**`
}

// ─── Node 2: Weather Context ──────────────────────────────────────────────────

export function weatherContextSystemPrompt(): string {
  return load("weather-context.md")
}

export function weatherContextUserPrompt(destination: string, travelMonth: string | null): string {
  const monthLine = travelMonth ? `\nTravel month: **${travelMonth}** (highlight this in travel_implications)` : ""
  return `Generate the full 12-month weather context for: **${destination}**${monthLine}`
}

// ─── Node 3+: Theme Experience Generation ────────────────────────────────────

export function themeSystemPrompt(): string {
  return load("system.md")
}

export function themeUserPrompt(
  themeId: string,
  destination: string,
  destContext: DestinationContext,
  weatherContext: WeatherContext | null,
  preferences?: Preferences,
  usedExperiences?: Array<{ name: string; location_hint?: string | null }>
): string {
  const parts: string[] = []

  // ── Destination context block ──────────────────────────────────────────────
  parts.push(`## Destination Context\n\n**Destination:** ${destination}\n\n**Soul:**\n${destContext.soul}\n\n**Defining pillars:** ${destContext.defining_pillars.join(" · ")}\n\n**Best for:** ${destContext.best_for.join(", ")}\n\n**Honest notes:**\n${destContext.honest_notes.map(n => `- ${n}`).join("\n")}`)

  // ── Weather context block ──────────────────────────────────────────────────
  if (weatherContext) {
    const travelMonth = weatherContext.travel_month
    const w = travelMonth ? weatherContext.months[travelMonth] : null

    if (travelMonth && w) {
      parts.push(`## Travel Month Weather — ${travelMonth}

**Season:** ${w.season_type.replace(/_/g, " ")} — ${w.season_notes}
**Temperature:** ${w.avg_high_f}°F high / ${w.avg_low_f}°F low (${w.avg_high_c}°C / ${w.avg_low_c}°C)
**Rain:** ~${w.avg_rainfall_inches}" over ~${w.rainy_days_estimate} rainy days
**Wind:** ~${w.avg_wind_mph} mph · **Humidity:** ${w.humidity_pct}% · **UV:** ${w.uv_index}
**Daylight:** ${w.sunrise} – ${w.sunset} (${w.daylight_hours} hrs)

**What this means for planning:**
${weatherContext.travel_implications.map(i => `- ${i}`).join("\n")}`)
    } else {
      parts.push(`## Climate Overview\n\n${weatherContext.annual_summary}`)
    }
  }

  // ── Preferences ────────────────────────────────────────────────────────────
  if (preferences && Object.keys(preferences).length > 0) {
    parts.push(`## Traveler Preferences\n${formatPreferences(preferences)}`)
  }

  // ── Already-used experiences (from Wave 1 signature call) ──────────────────
  if (usedExperiences && usedExperiences.length > 0) {
    const lines = usedExperiences.map(e =>
      e.location_hint ? `- ${e.name} (at: ${e.location_hint})` : `- ${e.name}`
    )
    parts.push(`## ⛔ Already Assigned — Do Not Repeat\n\nThe following experiences have already been assigned to the Signature theme. Do NOT generate a card for any of these, and do NOT create a card anchored to the same named place (even under a different activity name):\n\n${lines.join("\n")}\n\nIf a location here is genuinely the best place to do something in your theme, skip it entirely — it is covered.`)
  }

  // ── Theme task ─────────────────────────────────────────────────────────────
  const themeGuide = loadTheme(themeId)
  parts.push(`## Your Task\n\nGenerate experiences for the **${themeId}** theme at ${destination}.\n\n${themeGuide}\n\nReturn only valid JSON matching the output format in the system prompt.`)

  return parts.join("\n\n")
}

// ─── Node 4: Tip Enhancement ──────────────────────────────────────────────────

export function tipEnhancementSystemPrompt(): string {
  return `You are a hyper-specific travel tip writer. Your only job is to write one local_tip for a specific named travel experience.

Rules — non-negotiable:
- The tip must be impossible to detach from this exact named place. It cannot appear verbatim in a generic travel guide.
- BANNED phrases (do not write any of these): "arrive early", "bring binoculars", "book in advance", "book early", "wear comfortable shoes", "check the weather", "visit in the morning", "secure a good spot", "pack a picnic", "can get crowded", "during peak season", "small group sizes"
- DO write: a specific named pullout or viewpoint, what you'll see from a particular angle, the thing only repeat visitors know, a non-obvious access point, a specific feature within the larger area, best positioning intel
- HALLUCINATION GUARD — only cite specific times if they follow a real, verifiable pattern (geyser eruption schedules, sunrise/sunset, tidal patterns, scheduled ferry departures, ranger program times). Do NOT invent precise clock times like "10:47 AM" or "3:23 PM" — fabricated times actively mislead travelers. If timing matters, describe it in terms of conditions ("when the steam rises vertically in cool morning air", "at low tide", "after the crowds thin in late afternoon") rather than invented clock times.
- One or two sentences max. Concrete. Actionable. Tied to this exact place.
- Return ONLY the tip text. No JSON. No "Sure!" No explanation.`
}

export function tipEnhancementUserPrompt(
  name: string,
  locationHint: string,
  destination: string,
  theme: string,
  currentTip: string
): string {
  return `Write the best possible local_tip for this experience.

Experience: ${name}
Location: ${locationHint}
Destination: ${destination}
Theme: ${theme}
Current tip (likely too generic — do better): "${currentTip}"`
}

// ─── Itinerary Planning ───────────────────────────────────────────────────────

export function itinerarySystemPrompt(): string {
  return load("itinerary.md")
}

export function itineraryUserPrompt(
  board: Board,
  startDate: string,
  endDate: string,
  arrivalTime?: string,
  departureTime?: string,
  stayArea?: string,
  forcedIds: string[] = [],
  skippedIds: string[] = []
): string {
  const skippedSet = new Set(skippedIds)
  const forcedSet = new Set(forcedIds)

  const allExps: Array<Experience & { theme_name: string }> = []
  const foodDrinkExps: Array<Experience & { theme_name: string }> = []

  for (const theme of board.themes) {
    for (const exp of theme.experiences) {
      if (skippedSet.has(exp.id)) continue
      const tagged = { ...exp, theme_name: theme.name }
      allExps.push(tagged)
      if (theme.id === "food_drink" || theme.id === "food_crawls") foodDrinkExps.push(tagged)
    }
  }

  const days = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  const expList = allExps.map(e => {
    const forced = forcedSet.has(e.id) ? " [MUST INCLUDE]" : ""
    return `- id: ${e.id}${forced}\n  name: ${e.name}\n  theme: ${e.theme_name}\n  location: ${e.location_hint}\n  duration: ${e.duration}\n  best_time: ${e.best_time}\n  local_tip: ${e.local_tip}`
  }).join("\n\n")

  const foodList = foodDrinkExps.length > 0
    ? foodDrinkExps.map(e =>
        `- id: ${e.id}\n  name: ${e.name}\n  location: ${e.location_hint}\n  tip: ${e.local_tip}`
      ).join("\n\n")
    : "None on board — use your knowledge of well-known local options."

  const parts: string[] = []

  parts.push(`## Trip Details

Destination: ${board.destination}
Accommodation base: ${stayArea ?? board.destination_context.recommended_stay_area ?? board.destination}
Start date: ${startDate} — arrival time: ${arrivalTime ?? "09:00"}
End date: ${endDate} — departure time: ${departureTime ?? "12:00"}
Total days: ${days}

Every day starts and ends at the accommodation base above. The first travel row of each day should route from the accommodation to the first activity. The last activity of each day should end near the accommodation (or dinner nearby).`)

  parts.push(`## Destination Context\n\n${board.destination_context.soul}\n\nDefining pillars: ${board.destination_context.defining_pillars.join(" · ")}`)

  parts.push(`## All Available Experiences (${allExps.length} — select the best fit for ${days} days)\n\nExperiences marked [MUST INCLUDE] must appear in the itinerary.\n\n${expList}`)

  parts.push(`## Food & Drink Options (for meal slots)\n\n${foodList}`)

  parts.push(`## Your Task

Build the complete ${days}-day itinerary. Select the experiences that best use the traveler's time — geography, diversity, and significance. Any experience marked [MUST INCLUDE] must be scheduled. Fill all meal slots with real named places. Add travel rows between every activity pair.`)

  return parts.join("\n\n")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPreferences(prefs: Preferences): string {
  const lines: string[] = []
  if (prefs.dietary?.length)    lines.push(`- Dietary: ${prefs.dietary.join(", ")}`)
  if (prefs.interests?.length)  lines.push(`- Interests: ${prefs.interests.join(", ")}`)
  if (prefs.party_type)         lines.push(`- Party type: ${prefs.party_type}`)
  if (prefs.pace)               lines.push(`- Pace: ${prefs.pace}`)
  if (prefs.budget)             lines.push(`- Budget: ${prefs.budget}`)
  if (prefs.duration_days)      lines.push(`- Trip length: ${prefs.duration_days} days`)
  if (prefs.avoid?.length)      lines.push(`- Wants to avoid: ${prefs.avoid.join(", ")}`)
  return lines.join("\n")
}
