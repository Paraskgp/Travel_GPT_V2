import fs from "fs"
import path from "path"
import { Preferences, DestinationContext, WeatherContext } from "../types"

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
